import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  log: 20,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|csrf|otp|password|secret|session|token)/i;
const CLIENT_PII_KEY_PATTERN = /(email|phone|mobile|name|address|note)/i;

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private readonly configuredLevel: LogLevel;

  constructor(private readonly config: ConfigService) {
    this.configuredLevel = this.resolveLevel();
  }

  debug(message: unknown, context?: string | LogContext) {
    this.write('debug', this.message(message), this.context('debug', context, message));
  }

  log(message: unknown, context?: string | LogContext) {
    this.write('info', this.message(message), this.context('log', context, message));
  }

  verbose(message: unknown, context?: string | LogContext) {
    this.debug(message, context);
  }

  warn(message: unknown, context?: string | LogContext) {
    this.write('warn', this.message(message), this.context('warn', context, message));
  }

  error(message: unknown, trace?: string, context?: string | LogContext) {
    this.write('error', this.message(message), {
      ...this.context('error', context, message),
      ...(trace ? { stack: trace } : {}),
    });
  }

  event(level: LogLevel, event: string, message: string, context: LogContext = {}) {
    this.write(level, message, { ...context, event });
  }

  redactUnsafeClientContext(context: LogContext) {
    return this.redact(context, true) as LogContext;
  }

  private write(level: LogLevel, message: string, context: LogContext = {}) {
    if (!this.shouldWrite(level)) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level: level === 'log' ? 'info' : level,
      service: 'neara-api',
      event: context.event ?? 'application.log',
      message,
      ...(this.redact(context, false) as LogContext),
    };

    const serialized = `${JSON.stringify(payload)}\n`;
    if (level === 'warn' || level === 'error') {
      process.stderr.write(serialized);
    } else {
      process.stdout.write(serialized);
    }
  }

  private shouldWrite(level: LogLevel) {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.configuredLevel];
  }

  private resolveLevel(): LogLevel {
    const explicit = this.config.get<string>('LOG_LEVEL');
    if (explicit && this.isLogLevel(explicit)) {
      return explicit;
    }

    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    return nodeEnv === 'production' || nodeEnv === 'staging' ? 'info' : 'debug';
  }

  private isLogLevel(value: string): value is LogLevel {
    return ['debug', 'log', 'info', 'warn', 'error'].includes(value);
  }

  private message(value: unknown) {
    if (value instanceof Error) {
      return value.message;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
      return value.message;
    }
    return 'Log event';
  }

  private context(defaultEvent: string, context?: string | LogContext, message?: unknown): LogContext {
    const resolved = typeof context === 'string' ? { event: context } : context ?? {};
    if (message && typeof message === 'object' && !(message instanceof Error)) {
      return { ...(message as LogContext), ...resolved, event: resolved.event ?? defaultEvent };
    }
    return { ...resolved, event: resolved.event ?? defaultEvent };
  }

  private redact(value: unknown, redactClientPii: boolean): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item, redactClientPii));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key) || (redactClientPii && CLIENT_PII_KEY_PATTERN.test(key))) {
        redacted[key] = '[redacted]';
      } else {
        redacted[key] = this.redact(nestedValue, redactClientPii);
      }
    }
    return redacted;
  }
}
