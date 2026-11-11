import 'reflect-metadata';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { BadRequestException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TenantStatus } from '@prisma/client';
import { resolve } from 'path';
import { PlatformAdminService } from './modules/admin/platform-admin.service';
import { TenantAdminService } from './modules/admin/tenant-admin.service';
import { AnonymizeCustomerDto } from './modules/admin/dto/anonymize-customer.dto';
import { BookingStatusNoteDto } from './modules/admin/dto/booking-status-note.dto';
import { CreateAvailabilityExceptionDto } from './modules/admin/dto/create-availability-exception.dto';
import { CreateAvailabilityRuleDto } from './modules/admin/dto/create-availability-rule.dto';
import { CreateCategoryDto } from './modules/admin/dto/create-category.dto';
import { CreateExpertDto } from './modules/admin/dto/create-expert.dto';
import { CreateServiceDto } from './modules/admin/dto/create-service.dto';
import { CreateTenantAdminDto } from './modules/admin/dto/create-tenant-admin.dto';
import { CreateTenantDto } from './modules/admin/dto/create-tenant.dto';
import { GeocodeLocationQueryDto } from './modules/admin/dto/geocode-location-query.dto';
import { ListBookingsQueryDto } from './modules/admin/dto/list-bookings-query.dto';
import { ListLogsQueryDto } from './modules/admin/dto/list-logs-query.dto';
import { ListPlatformBookingsQueryDto } from './modules/admin/dto/list-platform-bookings-query.dto';
import { SetExpertServicesDto } from './modules/admin/dto/set-expert-services.dto';
import { UpdateCategoryDto } from './modules/admin/dto/update-category.dto';
import { UpdateExpertDto } from './modules/admin/dto/update-expert.dto';
import { UpdateServiceDto } from './modules/admin/dto/update-service.dto';
import { UpdateTenantDto } from './modules/admin/dto/update-tenant.dto';
import { UpdateTenantProfileDto } from './modules/admin/dto/update-tenant-profile.dto';
import { UpsertLocationDto } from './modules/admin/dto/upsert-location.dto';
import { AuditService } from './modules/audit/audit.service';
import { AuthService } from './modules/auth/auth.service';
import { CsrfService } from './modules/auth/csrf.service';
import { CustomerAuthService } from './modules/auth/customer-auth.service';
import {
  CustomerLoginDto,
  CustomerOtpConfirmDto,
  CustomerOtpRequestDto,
  PhoneVerifyConfirmDto,
  PhoneVerifyRequestDto,
  CustomerPasswordResetConfirmDto,
  CustomerRegisterDto,
} from './modules/auth/dto/customer-auth.dto';
import { ForgotPasswordDto } from './modules/auth/dto/forgot-password.dto';
import { LoginDto } from './modules/auth/dto/login.dto';
import { MfaCodeDto } from './modules/auth/dto/mfa-code.dto';
import {
  MobileLoginDto,
  MobileLogoutDto,
  MobilePasswordResetConfirmDto,
  MobilePasswordResetRequestDto,
  MobileRefreshDto,
} from './modules/auth/dto/mobile-auth.dto';
import { ResetPasswordDto } from './modules/auth/dto/reset-password.dto';
import { MfaService } from './modules/auth/mfa.service';
import { MobileAuthService } from './modules/auth/mobile-auth.service';
import { OtpService } from './modules/auth/otp.service';
import { SessionService } from './modules/auth/session.service';
import { AuthContext } from './modules/auth/types';
import { BookingService } from './modules/booking/booking.service';
import { CreatePublicBookingDto } from './modules/booking/dto/create-public-booking.dto';
import { LookupBookingQueryDto } from './modules/booking/dto/lookup-booking-query.dto';
import { HealthService } from './modules/health/health.service';
import { NotificationService } from './modules/notification/notification.service';
import { SmsService } from './modules/notification/sms.service';
import { ClientEventDto } from './modules/observability/dto/client-event.dto';
import { TenantSignupDto } from './modules/onboarding/dto/tenant-signup.dto';
import { OnboardingService } from './modules/onboarding/onboarding.service';
import { ObservabilityService } from './modules/observability/observability.service';
import { requestIdFrom } from './modules/observability/request-id';
import { StructuredLoggerService } from './modules/observability/structured-logger.service';
import { PrismaService } from './modules/prisma/prisma.service';
import { AvailableSlotsQueryDto } from './modules/public/dto/available-slots-query.dto';
import { PlaceAutocompleteQueryDto } from './modules/public/dto/place-autocomplete-query.dto';
import { ReverseGeocodeQueryDto } from './modules/public/dto/reverse-geocode-query.dto';
import { SearchTenantsQueryDto } from './modules/public/dto/search-tenants-query.dto';
import { PublicService } from './modules/public/public.service';
import { RateLimitBucket } from './modules/rate-limit/rate-limit.constants';
import { RateLimiter } from './modules/rate-limit/rate-limiter';
import { SchedulingService } from './modules/scheduling/scheduling.service';
import { UploadService } from './modules/upload/upload.service';
import { serve } from 'inngest/express';
import { inngest } from './modules/notification/inngest.client';
import * as inngestFunctions from './inngest/functions';
import { appConfigSchema } from './support/config.schema';
import { hasAmbiguousCookieHeader, isUnsafeMethod, noStore, securityHeaders } from './support/security';

if (process.env.VERCEL !== '1') {
  dotenv.config({ path: resolve(__dirname, '../../../.env') });
  dotenv.config({ path: resolve(__dirname, '../.env') });
}

type RouteHandler = (request: Request, response: Response) => Promise<unknown> | unknown;

function normalizedOrigin(value: string) {
  return value.trim().replace(/\/$/, '');
}

function allowedCorsOrigins(config: ConfigService) {
  const webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:3000');
  const extraOrigins = config.get<string>('CORS_ALLOWED_ORIGINS', '');
  return [webAppUrl, ...extraOrigins.split(',')]
    .map((origin) => normalizedOrigin(origin))
    .filter(Boolean);
}

function validateDto<T extends object>(type: new () => T, value: unknown): T {
  const instance = plainToInstance(type, value ?? {}, { enableImplicitConversion: true });
  const errors = validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    validationError: { target: false },
  });

  if (errors.length > 0) {
    throw new BadRequestException({
      message: 'Validation failed',
      errors: errors.map((error) => ({
        property: error.property,
        constraints: error.constraints,
      })),
    });
  }

  return instance;
}

function sendResult(response: Response, result: unknown) {
  if (response.headersSent) {
    return;
  }
  if (result === undefined) {
    response.status(204).send();
    return;
  }
  response.json(result);
}

function route(handler: RouteHandler) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      sendResult(response, await handler(request, response));
    } catch (error) {
      next(error);
    }
  };
}

function runMiddleware(handler: RequestHandler) {
  return (request: Request, response: Response) =>
    new Promise<void>((resolvePromise, rejectPromise) => {
      handler(request, response, (error?: unknown) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        resolvePromise();
      });
    });
}

function sourceIp(request: Request) {
  return request.ip || request.socket.remoteAddress;
}

/** Reject an oversized upload before a single byte is buffered. */
function assertUploadSize(request: Request, maxBytes: number) {
  const header = request.headers['content-length'];
  if (!header) {
    return;
  }
  const declared = Number(header);
  if (!Number.isFinite(declared) || declared < 0) {
    throw new BadRequestException('Upload content length is invalid');
  }
  if (declared > maxBytes + 64 * 1024) {
    throw new HttpException({ message: 'Image is too large' }, 413);
  }
}

function stringBody(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function identifierKey(request: Request) {
  const body = request.body as Record<string, unknown> | undefined;
  return (
    stringBody(body?.identifier)?.toLowerCase() ??
    stringBody(body?.email)?.toLowerCase() ??
    stringBody(body?.phone)
  );
}

function buildApp(): express.Express {
  const parsedConfig = appConfigSchema.parse(process.env);
  const config = new ConfigService(parsedConfig);
  const logger = new StructuredLoggerService(config);
  const prisma = new PrismaService();
  const audit = new AuditService(prisma);
  const sms = new SmsService(config, logger);
  const notifications = new NotificationService(config, prisma, logger, sms);
  const csrf = new CsrfService(config);
  const sessions = new SessionService(config, prisma, csrf);
  const otp = new OtpService(config, prisma, notifications, audit);
  const mfa = new MfaService(config, prisma, audit);
  const customerAuth = new CustomerAuthService(config, notifications, prisma, sessions, audit, otp, csrf);
  const mobileAuth = new MobileAuthService(config, prisma, sessions, otp, audit, notifications);
  const auth = new AuthService(config, csrf, notifications, prisma, sessions, mfa, mobileAuth);
  const onboarding = new OnboardingService(audit, auth, prisma);
  const scheduling = new SchedulingService(prisma);
  const booking = new BookingService(audit, notifications, prisma, scheduling);
  const publicService = new PublicService(prisma, config);
  const uploads = new UploadService(config, prisma);
  const tenantAdmin = new TenantAdminService(audit, notifications, prisma, uploads, config);
  const platformAdmin = new PlatformAdminService(audit, notifications, prisma, sessions);
  const health = new HealthService(config, prisma);
  const observability = new ObservabilityService(config, logger);

  const uploadMaxBytes = config.get<number>('UPLOAD_MAX_IMAGE_BYTES', 4 * 1024 * 1024);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: uploadMaxBytes,
      files: 1,
      fields: 10,
      parts: 12,
      headerPairs: 60,
    },
  });
  const uploadFile = upload.single('file') as unknown as RequestHandler;
  const limiter = new RateLimiter(config, logger);
  const limit = (bucket: RateLimitBucket, keyOf?: (request: Request) => string | undefined) =>
    limiter.middleware(bucket, keyOf);

  const production = ['production', 'staging'].includes(config.get<string>('NODE_ENV', 'development'));
  const app = express();

  app.all(
    '/api/inngest',
    serve({
      client: inngest,
      functions: Object.values(inngestFunctions),
    }),
  );

  app.disable('x-powered-by');
  app.set('etag', false);
  // Trust exactly the configured number of proxies so `request.ip` is the real
  // client address. A client-supplied X-Forwarded-For is never parsed by hand.
  const trustProxyHops = Number(config.get<number>('TRUST_PROXY_HOPS', 1));
  app.set('trust proxy', Number.isFinite(trustProxyHops) && trustProxyHops > 0 ? trustProxyHops : false);

  app.use(securityHeaders({ production }));
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigins = allowedCorsOrigins(config);
        if (!origin || allowedOrigins.includes(normalizedOrigin(origin))) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['content-type', 'x-request-id', 'x-csrf-token', 'authorization'],
      exposedHeaders: ['x-request-id', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after'],
      optionsSuccessStatus: 204,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  app.use((request, _response, next) => {
    if (hasAmbiguousCookieHeader(request)) {
      next(new BadRequestException('Cookie header is malformed'));
      return;
    }
    next();
  });

  app.use((request, response, next) => {
    const requestId = requestIdFrom(request) ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    response.setHeader('x-request-id', requestId);
    const startedAt = Date.now();
    response.on('finish', () => {
      logger.event('info', 'http.request', `${request.method} ${request.originalUrl} ${response.statusCode}`, {
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    next();
  });

  const api = express.Router();
  api.use(['/admin/auth', '/public/auth', '/mobile/auth'], noStore);
  app.use('/api', api);

  function platformAuth(handler: (authContext: AuthContext, request: Request, response: Response) => unknown) {
    return route(async (request, response) => handler(await auth.requirePlatformAdmin(request), request, response));
  }

  /**
   * Highest-risk platform actions additionally require a recent authentication
   * (active when the operator has MFA enrolled or platform MFA is required).
   */
  function platformSensitiveAuth(handler: (authContext: AuthContext, request: Request, response: Response) => unknown) {
    return route(async (request, response) => {
      const authContext = await auth.requirePlatformAdmin(request);
      auth.assertFreshAuthentication(authContext);
      return handler(authContext, request, response);
    });
  }

  function tenantAuth(handler: (authContext: AuthContext, request: Request, response: Response) => unknown) {
    return route(async (request, response) => handler(await auth.requireTenantAdmin(request, request.params.tenantId), request, response));
  }

  async function customerContext(request: Request, requireCsrf = false) {
    return auth.requireCustomerContext(request, { requireCsrf });
  }

  api.get('/health', route(() => health.basic()));
  api.get('/health/dependencies', route(() => health.dependencies()));

  api.post(
    '/observability/client-events',
    limit('CLIENT_EVENTS'),
    route((request) => {
      const dto = validateDto(ClientEventDto, request.body);
      const safeEvent = logger.redactUnsafeClientContext({
        ...dto,
        requestId: dto.requestId ?? requestIdFrom(request),
        ip: request.ip,
        userAgent: request.header('user-agent')?.slice(0, 160),
      });
      logger.event('warn', 'client.event.received', dto.message ?? dto.event, safeEvent);
      return { ok: true };
    }),
  );

  // ---- Admin / web cookie auth -------------------------------------------------
  api.post(
    '/admin/auth/login',
    limit('ADMIN_LOGIN'),
    limit('ADMIN_LOGIN', identifierKey),
    route((request, response) => auth.login(validateDto(LoginDto, request.body), request, response)),
  );
  api.post(
    '/admin/auth/password-reset/request',
    limit('PASSWORD_RESET'),
    limit('PASSWORD_RESET', identifierKey),
    route((request) => auth.requestPasswordReset(validateDto(ForgotPasswordDto, request.body))),
  );
  api.post(
    '/admin/auth/password-reset/confirm',
    limit('PASSWORD_RESET'),
    route((request) => auth.resetPassword(validateDto(ResetPasswordDto, request.body))),
  );
  api.post('/admin/auth/logout', route((request, response) => auth.logout(request, response)));
  api.get('/admin/auth/me', route(async (request) => auth.serializeContext(await auth.requireAdminContext(request, { requireCsrf: false }))));
  api.get(
    '/admin/auth/sessions',
    route(async (request) => {
      const context = await auth.requireAdminContext(request, { requireCsrf: false });
      return { items: await sessions.listForUser(context.user.id) };
    }),
  );
  api.delete(
    '/admin/auth/sessions/:id',
    route(async (request) => {
      const context = await auth.requireAdminContext(request, { requireCsrf: true });
      await sessions.revokeListedSession(context.user.id, request.params.id);
      return { ok: true };
    }),
  );
  api.post(
    '/admin/auth/mfa/enroll',
    route(async (request) => {
      const context = await auth.requireAdminContext(request, { requireCsrf: true });
      return mfa.beginEnrollment(context.user.id, context.user.email ?? context.user.id);
    }),
  );
  api.post(
    '/admin/auth/mfa/confirm',
    route(async (request) => {
      const context = await auth.requireAdminContext(request, { requireCsrf: true });
      return mfa.confirmEnrollment(context.user.id, validateDto(MfaCodeDto, request.body).code, sourceIp(request));
    }),
  );
  api.post(
    '/admin/auth/mfa/disable',
    route(async (request) => {
      const context = await auth.requireAdminContext(request, { requireCsrf: true });
      return mfa.disable(context.user.id, validateDto(MfaCodeDto, request.body).code, sourceIp(request));
    }),
  );

  // ---- Customer cookie auth ----------------------------------------------------
  api.post(
    '/public/auth/register',
    limit('CUSTOMER_REGISTER'),
    limit('CUSTOMER_REGISTER', identifierKey),
    route((request, response) => customerAuth.register(validateDto(CustomerRegisterDto, request.body), request, response)),
  );
  api.post(
    '/public/auth/login',
    limit('CUSTOMER_LOGIN'),
    limit('CUSTOMER_LOGIN', identifierKey),
    route((request, response) => customerAuth.login(validateDto(CustomerLoginDto, request.body), request, response)),
  );
  api.post(
    '/public/auth/otp/request',
    limit('CUSTOMER_OTP_REQUEST'),
    limit('CUSTOMER_OTP_REQUEST', identifierKey),
    route((request) => customerAuth.requestOtp(validateDto(CustomerOtpRequestDto, request.body))),
  );
  api.post(
    '/public/auth/otp/confirm',
    limit('CUSTOMER_OTP_CONFIRM'),
    limit('CUSTOMER_OTP_CONFIRM', identifierKey),
    route((request, response) => customerAuth.confirmOtp(validateDto(CustomerOtpConfirmDto, request.body), request, response)),
  );
  api.post(
    '/public/auth/password-reset/request',
    limit('CUSTOMER_OTP_REQUEST'),
    limit('CUSTOMER_OTP_REQUEST', identifierKey),
    route((request) => customerAuth.requestOtp({ ...validateDto(CustomerOtpRequestDto, request.body), purpose: 'password_reset' })),
  );
  api.post(
    '/public/auth/password-reset/confirm',
    limit('CUSTOMER_OTP_CONFIRM'),
    limit('CUSTOMER_OTP_CONFIRM', identifierKey),
    route((request) => customerAuth.confirmPasswordReset(validateDto(CustomerPasswordResetConfirmDto, request.body))),
  );
  api.post(
    '/public/auth/verify/request',
    limit('CUSTOMER_OTP_REQUEST'),
    limit('CUSTOMER_OTP_REQUEST', identifierKey),
    route((request) => customerAuth.requestEmailVerification(validateDto(CustomerOtpRequestDto, request.body).identifier)),
  );
  api.post(
    '/public/auth/verify/confirm',
    limit('CUSTOMER_OTP_CONFIRM'),
    route((request) => {
      const dto = validateDto(CustomerOtpConfirmDto, { ...request.body, purpose: 'login' });
      return customerAuth.confirmEmailVerification(dto.identifier, dto.otp);
    }),
  );
  api.post(
    '/public/auth/verify/phone/request',
    limit('CUSTOMER_OTP_REQUEST'),
    limit('CUSTOMER_OTP_REQUEST', identifierKey),
    route((request) => {
      const dto = validateDto(PhoneVerifyRequestDto, request.body);
      return customerAuth.requestPhoneVerification(dto.identifier, dto.channel);
    }),
  );
  api.post(
    '/public/auth/verify/phone/confirm',
    limit('CUSTOMER_OTP_CONFIRM'),
    limit('CUSTOMER_OTP_CONFIRM', identifierKey),
    route((request) => {
      const dto = validateDto(PhoneVerifyConfirmDto, request.body);
      return customerAuth.confirmPhoneVerification(dto.identifier, dto.otp, dto.channel);
    }),
  );
  api.post('/public/auth/logout', route((request, response) => customerAuth.logout(request, response)));
  api.get('/public/auth/me', route((request) => customerAuth.me(request)));
  api.delete('/public/auth/me', route((request, response) => customerAuth.deleteMe(request, response, sourceIp(request))));
  api.get(
    '/public/auth/sessions',
    route(async (request) => {
      const context = await customerContext(request);
      return { items: await sessions.listForUser(context.user.id) };
    }),
  );
  api.delete(
    '/public/auth/sessions/:id',
    route(async (request) => {
      const context = await customerContext(request, true);
      await sessions.revokeListedSession(context.user.id, request.params.id);
      return { ok: true };
    }),
  );

  // ---- Native bearer auth (M-04) ----------------------------------------------
  api.post(
    '/mobile/auth/login',
    limit('MOBILE_AUTH'),
    limit('MOBILE_AUTH', identifierKey),
    route((request) => mobileAuth.login(validateDto(MobileLoginDto, request.body), request)),
  );
  api.post('/mobile/auth/refresh', limit('MOBILE_REFRESH'), route((request) => mobileAuth.refresh(validateDto(MobileRefreshDto, request.body), request)));
  api.post('/mobile/auth/logout', limit('MOBILE_REFRESH'), route((request) => mobileAuth.logout(validateDto(MobileLogoutDto, request.body).refreshToken)));
  api.post(
    '/mobile/auth/logout-all',
    route(async (request) => mobileAuth.logoutAll(await mobileAuth.requireContext(request))),
  );
  api.get('/mobile/auth/sessions', route(async (request) => mobileAuth.listSessions(await mobileAuth.requireContext(request))));
  api.delete(
    '/mobile/auth/sessions/:id',
    route(async (request) => mobileAuth.revokeSession(await mobileAuth.requireContext(request), request.params.id)),
  );
  api.get('/mobile/auth/me', route(async (request) => mobileAuth.me(await mobileAuth.requireContext(request))));
  // Native right-to-erasure, sharing the web erasure path.
  api.delete(
    '/mobile/auth/me',
    route(async (request) => customerAuth.eraseForUser((await mobileAuth.requireContext(request, ['customer'])).user.id, sourceIp(request))),
  );
  api.post(
    '/mobile/auth/password-reset/request',
    limit('PASSWORD_RESET'),
    limit('PASSWORD_RESET', identifierKey),
    route((request) => mobileAuth.requestPasswordReset(validateDto(MobilePasswordResetRequestDto, request.body))),
  );
  api.post(
    '/mobile/auth/password-reset/confirm',
    limit('PASSWORD_RESET'),
    route((request) => mobileAuth.confirmPasswordReset(validateDto(MobilePasswordResetConfirmDto, request.body))),
  );

  // ---- Public discovery ---------------------------------------------------------
  api.get('/public/tenant-slug/check', limit('TENANT_SIGNUP'), route((request) => onboarding.checkSlug(String(request.query.slug ?? ''))));
  api.post(
    '/public/tenant-signup',
    limit('TENANT_SIGNUP'),
    route((request, response) => onboarding.signUp(validateDto(TenantSignupDto, request.body), response, sourceIp(request))),
  );

  api.get('/public/meta', route(() => ({
    namespace: 'public',
    authentication: 'anonymous discovery, customer session required for slots and bookings',
    mvpGuardrails: { customerAccounts: true, payments: false, rescheduling: false },
  })));
  api.get('/public/categories', route(() => publicService.listCategories()));
  api.get('/public/tenants', limit('PUBLIC_SEARCH'), route((request) => publicService.searchTenants(validateDto(SearchTenantsQueryDto, request.query))));
  api.get('/public/reverse-geocode', limit('PUBLIC_SEARCH'), route((request) => {
    const query = validateDto(ReverseGeocodeQueryDto, request.query);
    return publicService.reverseGeocode(query.latitude, query.longitude);
  }));
  api.get('/public/place-autocomplete', limit('PUBLIC_SEARCH'), route((request) => publicService.placeAutocomplete(validateDto(PlaceAutocompleteQueryDto, request.query).input)));

  api.get(
    '/public/bookings/lookup',
    limit('PUBLIC_BOOKING_LOOKUP'),
    limit('PUBLIC_BOOKING_LOOKUP', (request) => stringBody(request.query.reference)?.toUpperCase()),
    limit('PUBLIC_BOOKING_LOOKUP', (request) => stringBody(request.query.phone)),
    route(async (request) => {
      let viewer: { userId: string; mobileNumber: string | null } | undefined;
      try {
        const context = await customerContext(request);
        viewer = { userId: context.user.id, mobileNumber: context.user.mobileNumber };
      } catch {
        viewer = undefined;
      }
      return booking.lookupBooking(validateDto(LookupBookingQueryDto, request.query), viewer, sourceIp(request));
    }),
  );

  api.get('/public/tenants/:slug/services', route((request) => publicService.listTenantServices(request.params.slug)));
  api.get('/public/tenants/:slug/experts', route((request) => publicService.listTenantExperts(request.params.slug)));
  api.get('/public/tenants/:slug/available-slots', limit('PUBLIC_SLOT_LOOKUP'), route(async (request) => {
    await customerContext(request);
    const query = validateDto(AvailableSlotsQueryDto, request.query);
    return scheduling.getAvailableSlots({
      tenantSlug: request.params.slug,
      serviceId: query.serviceId,
      expertId: query.expertId,
      date: query.date,
    });
  }));
  api.post(
    '/public/tenants/:slug/bookings',
    limit('PUBLIC_BOOKING_CREATE'),
    limit('PUBLIC_BOOKING_CREATE', (request) => stringBody((request.body as Record<string, unknown>)?.customerPhone)),
    route(async (request) => {
      // Cookie-auth mutation: CSRF token and browser origin signals are enforced.
      const context = await customerContext(request, true);
      return booking.createPublicBooking(request.params.slug, validateDto(CreatePublicBookingDto, request.body), sourceIp(request), {
        id: context.user.id,
        email: context.user.email,
        mobileNumber: context.user.mobileNumber,
      });
    }),
  );
  api.get('/public/tenants/:slug', route((request) => publicService.getTenantBySlug(request.params.slug)));

  // ---- Platform admin ----------------------------------------------------------
  api.get('/admin/platform/meta', platformAuth((authContext) => ({
    namespace: 'admin/platform',
    authentication: 'secure-cookie-session',
    authorization: 'platform_admin',
    user: authContext.user,
  })));
  api.get('/admin/platform/categories', platformAuth(() => platformAdmin.listCategories()));
  api.post('/admin/platform/categories', platformAuth((authContext, request) => platformAdmin.createCategory(validateDto(CreateCategoryDto, request.body), authContext, sourceIp(request))));
  api.patch('/admin/platform/categories/:id', platformAuth((authContext, request) => platformAdmin.updateCategory(request.params.id, validateDto(UpdateCategoryDto, request.body), authContext, sourceIp(request))));
  api.get('/admin/platform/tenants', platformAuth(() => platformAdmin.listTenants()));
  api.post('/admin/platform/tenants', platformAuth((authContext, request) => platformAdmin.createTenant(validateDto(CreateTenantDto, request.body), authContext, sourceIp(request))));
  api.get('/admin/platform/audit-logs', platformAuth((_authContext, request) => platformAdmin.listAuditLogs(validateDto(ListLogsQueryDto, request.query))));
  api.get('/admin/platform/notification-logs', platformAuth((_authContext, request) => platformAdmin.listNotificationLogs(validateDto(ListLogsQueryDto, request.query))));
  api.get('/admin/platform/queue/notifications', platformAuth(() => platformAdmin.notificationQueueStats()));
  api.get('/admin/platform/bookings', platformAuth((_authContext, request) => platformAdmin.listBookings(validateDto(ListPlatformBookingsQueryDto, request.query))));
  api.get('/admin/platform/bookings/:bookingId', platformAuth((authContext, request) => platformAdmin.getBooking(request.params.bookingId, authContext, sourceIp(request))));
  api.post('/admin/platform/bookings/:bookingId/cancel', platformAuth((authContext, request) => platformAdmin.cancelBooking(request.params.bookingId, validateDto(BookingStatusNoteDto, request.body), authContext, sourceIp(request))));
  api.get('/admin/platform/tenants/:id', platformAuth((_authContext, request) => platformAdmin.getTenant(request.params.id)));
  api.patch('/admin/platform/tenants/:id', platformAuth((authContext, request) => platformAdmin.updateTenant(request.params.id, validateDto(UpdateTenantDto, request.body), authContext, sourceIp(request))));
  api.post('/admin/platform/tenants/:id/activate', platformSensitiveAuth((authContext, request) => platformAdmin.activateTenant(request.params.id, authContext, sourceIp(request))));
  api.post('/admin/platform/tenants/:id/inactivate', platformSensitiveAuth((authContext, request) => platformAdmin.setTenantStatus(request.params.id, TenantStatus.inactive, authContext, sourceIp(request))));
  api.post('/admin/platform/tenants/:id/suspend', platformSensitiveAuth((authContext, request) => platformAdmin.setTenantStatus(request.params.id, TenantStatus.suspended, authContext, sourceIp(request))));
  api.post('/admin/platform/customers/anonymize', platformSensitiveAuth((authContext, request) => platformAdmin.anonymizeCustomer(validateDto(AnonymizeCustomerDto, request.body), authContext, sourceIp(request))));
  api.post('/admin/platform/tenants/:id/admins/first', platformAuth((authContext, request) => platformAdmin.createFirstTenantAdmin(request.params.id, validateDto(CreateTenantAdminDto, request.body), authContext, sourceIp(request))));

  // ---- Tenant admin -------------------------------------------------------------
  api.get('/admin/tenant/meta', route(async (request) => {
    const authContext = await auth.requireTenantAdmin(request);
    return {
      namespace: 'admin/tenant',
      authentication: 'secure-cookie-session',
      authorization: 'tenant_membership',
      user: authContext.user,
    };
  }));
  api.get('/admin/tenant/:tenantId/dashboard', tenantAuth((authContext, request) => tenantAdmin.getDashboard(request.params.tenantId, authContext)));
  api.get('/admin/tenant/:tenantId/profile', tenantAuth((authContext, request) => tenantAdmin.getProfile(request.params.tenantId, authContext)));
  api.get('/admin/tenant/:tenantId/onboarding', tenantAuth((authContext, request) => onboarding.status(request.params.tenantId, authContext)));
  api.post('/admin/tenant/:tenantId/onboarding/complete', tenantAuth((authContext, request) => onboarding.complete(request.params.tenantId, authContext, sourceIp(request))));
  api.patch('/admin/tenant/:tenantId/profile', tenantAuth((authContext, request) => tenantAdmin.updateProfile(request.params.tenantId, validateDto(UpdateTenantProfileDto, request.body), authContext, sourceIp(request))));
  api.get('/admin/tenant/:tenantId/locations', tenantAuth((authContext, request) => tenantAdmin.listLocations(request.params.tenantId, authContext)));
  api.post('/admin/tenant/:tenantId/locations/primary', tenantAuth((authContext, request) => tenantAdmin.upsertPrimaryLocation(request.params.tenantId, validateDto(UpsertLocationDto, request.body), authContext, sourceIp(request))));
  api.get('/admin/tenant/:tenantId/geocode', tenantAuth((authContext, request) => tenantAdmin.geocodeLocation(request.params.tenantId, validateDto(GeocodeLocationQueryDto, request.query).address, authContext)));

  // Uploads authenticate and authorise before buffering the multipart body.
  api.post(
    '/admin/tenant/:tenantId/logo',
    tenantAuth(async (authContext, request, response) => {
      assertUploadSize(request, uploadMaxBytes);
      await runMiddleware(uploadFile)(request, response);
      return tenantAdmin.uploadTenantLogo(request.params.tenantId, request.file!, authContext, sourceIp(request));
    }),
  );
  api.get('/admin/tenant/:tenantId/services', tenantAuth((authContext, request) => tenantAdmin.listServices(request.params.tenantId, authContext)));
  api.post('/admin/tenant/:tenantId/services', tenantAuth((authContext, request) => tenantAdmin.createService(request.params.tenantId, validateDto(CreateServiceDto, request.body), authContext, sourceIp(request))));
  api.patch('/admin/tenant/:tenantId/services/:serviceId', tenantAuth((authContext, request) => tenantAdmin.updateService(request.params.tenantId, request.params.serviceId, validateDto(UpdateServiceDto, request.body), authContext, sourceIp(request))));
  api.get('/admin/tenant/:tenantId/experts', tenantAuth((authContext, request) => tenantAdmin.listExperts(request.params.tenantId, authContext)));
  api.post('/admin/tenant/:tenantId/experts', tenantAuth((authContext, request) => tenantAdmin.createExpert(request.params.tenantId, validateDto(CreateExpertDto, request.body), authContext, sourceIp(request))));
  api.patch('/admin/tenant/:tenantId/experts/:expertId', tenantAuth((authContext, request) => tenantAdmin.updateExpert(request.params.tenantId, request.params.expertId, validateDto(UpdateExpertDto, request.body), authContext, sourceIp(request))));
  api.post(
    '/admin/tenant/:tenantId/experts/:expertId/photo',
    tenantAuth(async (authContext, request, response) => {
      assertUploadSize(request, uploadMaxBytes);
      await runMiddleware(uploadFile)(request, response);
      return tenantAdmin.uploadExpertPhoto(request.params.tenantId, request.params.expertId, request.file!, authContext, sourceIp(request));
    }),
  );
  api.post('/admin/tenant/:tenantId/experts/:expertId/services', tenantAuth((authContext, request) => tenantAdmin.setExpertServices(request.params.tenantId, request.params.expertId, validateDto(SetExpertServicesDto, request.body), authContext, sourceIp(request))));
  api.get('/admin/tenant/:tenantId/experts/:expertId/availability-rules', tenantAuth((authContext, request) => tenantAdmin.listAvailabilityRules(request.params.tenantId, request.params.expertId, authContext)));
  api.post('/admin/tenant/:tenantId/experts/:expertId/availability-rules', tenantAuth((authContext, request) => tenantAdmin.createAvailabilityRule(request.params.tenantId, request.params.expertId, validateDto(CreateAvailabilityRuleDto, request.body), authContext, sourceIp(request))));
  api.delete('/admin/tenant/:tenantId/experts/:expertId/availability-rules/:ruleId', tenantAuth((authContext, request) => tenantAdmin.deleteAvailabilityRule(request.params.tenantId, request.params.expertId, request.params.ruleId, authContext, sourceIp(request))));
  api.get('/admin/tenant/:tenantId/experts/:expertId/availability-exceptions', tenantAuth((authContext, request) => tenantAdmin.listAvailabilityExceptions(request.params.tenantId, request.params.expertId, authContext)));
  api.post('/admin/tenant/:tenantId/experts/:expertId/availability-exceptions', tenantAuth((authContext, request) => tenantAdmin.createAvailabilityException(request.params.tenantId, request.params.expertId, validateDto(CreateAvailabilityExceptionDto, request.body), authContext, sourceIp(request))));
  api.delete('/admin/tenant/:tenantId/experts/:expertId/availability-exceptions/:exceptionId', tenantAuth((authContext, request) => tenantAdmin.deleteAvailabilityException(request.params.tenantId, request.params.expertId, request.params.exceptionId, authContext, sourceIp(request))));
  api.get('/admin/tenant/:tenantId/bookings', tenantAuth((authContext, request) => tenantAdmin.listBookings(request.params.tenantId, validateDto(ListBookingsQueryDto, request.query), authContext)));
  api.get('/admin/tenant/:tenantId/bookings/:bookingId', tenantAuth((authContext, request) => tenantAdmin.getBooking(request.params.tenantId, request.params.bookingId, authContext)));
  api.post('/admin/tenant/:tenantId/bookings/:bookingId/cancel', tenantAuth((authContext, request) => tenantAdmin.cancelBooking(request.params.tenantId, request.params.bookingId, validateDto(BookingStatusNoteDto, request.body), authContext, sourceIp(request))));
  api.post('/admin/tenant/:tenantId/bookings/:bookingId/complete', tenantAuth((authContext, request) => tenantAdmin.completeBooking(request.params.tenantId, request.params.bookingId, validateDto(BookingStatusNoteDto, request.body), authContext, sourceIp(request))));
  api.post('/admin/tenant/:tenantId/bookings/:bookingId/no-show', tenantAuth((authContext, request) => tenantAdmin.markBookingNoShow(request.params.tenantId, request.params.bookingId, validateDto(BookingStatusNoteDto, request.body), authContext, sourceIp(request))));

  api.use((_request, _response, next) => next(new HttpException('Route not found', 404)));

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const isMulterError = error instanceof multer.MulterError;
    const status = isMulterError
      ? error.code === 'LIMIT_FILE_SIZE'
        ? 413
        : 400
      : error instanceof HttpException
        ? error.getStatus()
        : 500;
    const exception = error instanceof Error ? error : new InternalServerErrorException('Unknown error');

    if (status >= 500) {
      observability.captureException(exception, {
        method: request.method,
        path: request.originalUrl,
        requestId: requestIdFrom(request),
      });
    }

    let payload: unknown;
    if (isMulterError) {
      payload = { message: error.code === 'LIMIT_FILE_SIZE' ? 'Image is too large' : 'Upload was rejected' };
    } else if (error instanceof HttpException) {
      payload = error.getResponse();
    } else {
      payload = { message: 'Internal server error' };
    }

    const body = typeof payload === 'string' ? { message: payload } : (payload as Record<string, unknown>);
    const retryAfter = typeof body.retryAfter === 'number' ? body.retryAfter : undefined;
    if (retryAfter) {
      response.setHeader('retry-after', String(retryAfter));
    }

    if (response.headersSent) {
      if (error instanceof Error) {
        response.destroy();
      }
      return;
    }

    response.status(status).json(body);
  });

  const port = config.get<number>('API_PORT', 4000);

  if (require.main === module) {
    app.listen(port, () => {
      logger.event('info', 'api.started', `Neara Express API listening on ${port}`, { port });
    });
  }

  return app;
}

let app: express.Express;
try {
  app = buildApp();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown initialization error';
  if (typeof process !== 'undefined' && process.stderr) {
    process.stderr.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'fatal',
        event: 'app.init.failed',
        message: `Failed to initialize Neara API: ${message}`,
        ...(error instanceof Error ? { stack: error.stack } : {}),
      }) + '\n',
    );
  }
  app = express();
  app.disable('x-powered-by');
  app.use((_req, res) => {
    res.status(503).json({
      error: 'Service temporarily unavailable',
      ...(process.env.NODE_ENV === 'production' ? {} : { message }),
    });
  });
}

export default app;
module.exports = app;
module.exports.default = app;
