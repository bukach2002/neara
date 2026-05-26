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
  CustomerPasswordResetConfirmDto,
  CustomerRegisterDto,
} from './modules/auth/dto/customer-auth.dto';
import { ForgotPasswordDto } from './modules/auth/dto/forgot-password.dto';
import { LoginDto } from './modules/auth/dto/login.dto';
import { ResetPasswordDto } from './modules/auth/dto/reset-password.dto';
import { AuthContext } from './modules/auth/types';
import { BookingService } from './modules/booking/booking.service';
import { CreatePublicBookingDto } from './modules/booking/dto/create-public-booking.dto';
import { LookupBookingQueryDto } from './modules/booking/dto/lookup-booking-query.dto';
import { HealthService } from './modules/health/health.service';
import { NotificationService } from './modules/notification/notification.service';
import { ClientEventDto } from './modules/observability/dto/client-event.dto';
import { ObservabilityService } from './modules/observability/observability.service';
import { requestIdFrom } from './modules/observability/request-id';
import { StructuredLoggerService } from './modules/observability/structured-logger.service';
import { PrismaService } from './modules/prisma/prisma.service';
import { AvailableSlotsQueryDto } from './modules/public/dto/available-slots-query.dto';
import { PlaceAutocompleteQueryDto } from './modules/public/dto/place-autocomplete-query.dto';
import { ReverseGeocodeQueryDto } from './modules/public/dto/reverse-geocode-query.dto';
import { SearchTenantsQueryDto } from './modules/public/dto/search-tenants-query.dto';
import { PublicService } from './modules/public/public.service';
import { RATE_LIMIT_ENV, RateLimitBucket } from './modules/rate-limit/rate-limit.constants';
import { SchedulingService } from './modules/scheduling/scheduling.service';
import { UploadService } from './modules/upload/upload.service';
import { appConfigSchema } from './support/config.schema';

dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config({ path: resolve(__dirname, '../.env') });

type RouteHandler = (request: Request, response: Response) => Promise<unknown> | unknown;

type Counter = {
  count: number;
  resetAt: number;
};

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

function sourceIp(request: Request) {
  return request.ip || request.socket.remoteAddress;
}

function clientKey(request: Request) {
  const forwardedFor = request.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || request.ip || request.socket.remoteAddress || 'unknown';
}

function createRateLimiter(config: ConfigService, logger: StructuredLoggerService) {
  const counters = new Map<string, Counter>();

  function defaultLimit(bucket: RateLimitBucket) {
    switch (bucket) {
      case 'PUBLIC_SEARCH':
        return 100;
      case 'PUBLIC_SLOT_LOOKUP':
        return 120;
      case 'PUBLIC_BOOKING_CREATE':
        return 20;
      case 'PUBLIC_BOOKING_LOOKUP':
        return 30;
      case 'ADMIN_LOGIN':
        return 10;
      case 'PASSWORD_RESET':
        return 5;
      case 'CUSTOMER_REGISTER':
        return 10;
      case 'CUSTOMER_LOGIN':
        return 10;
      case 'CUSTOMER_OTP_REQUEST':
        return 5;
      case 'CUSTOMER_OTP_CONFIRM':
        return 20;
    }
  }

  function windowSecondsFor(bucket: RateLimitBucket) {
    if (bucket === 'PASSWORD_RESET' || bucket === 'CUSTOMER_OTP_REQUEST') {
      return 60 * 60;
    }
    return config.get<number>('RATE_LIMIT_WINDOW_SECONDS', 60);
  }

  return (bucket: RateLimitBucket) => (request: Request, _response: Response, next: NextFunction) => {
    try {
      const key = `${bucket}:${clientKey(request)}`;
      const limit = config.get<number>(RATE_LIMIT_ENV[bucket], defaultLimit(bucket));
      const windowMs = windowSecondsFor(bucket) * 1000;
      const now = Date.now();
      const counter = counters.get(key);

      if (!counter || counter.resetAt <= now) {
        counters.set(key, { count: 1, resetAt: now + windowMs });
        next();
        return;
      }

      if (counter.count >= limit) {
        throw new HttpException(
          {
            message: 'Rate limit exceeded',
            limit,
            resetAt: new Date(counter.resetAt).toISOString(),
          },
          429,
        );
      }

      counter.count += 1;
      next();
    } catch (error) {
      logger.event('warn', 'rate_limit.rejected', error instanceof Error ? error.message : 'Rate limit rejected');
      next(error);
    }
  };
}

const parsedConfig = appConfigSchema.parse(process.env);
const config = new ConfigService(parsedConfig);
const logger = new StructuredLoggerService(config);
const prisma = new PrismaService();
const audit = new AuditService(prisma);
const notifications = new NotificationService(config, prisma, logger);
const csrf = new CsrfService(config);
const auth = new AuthService(config, csrf, notifications, prisma);
const customerAuth = new CustomerAuthService(config, notifications, prisma);
const scheduling = new SchedulingService(prisma);
const booking = new BookingService(audit, notifications, prisma, scheduling);
const publicService = new PublicService(prisma, config);
const uploads = new UploadService(config, prisma);
const tenantAdmin = new TenantAdminService(audit, notifications, prisma, uploads, config);
const platformAdmin = new PlatformAdminService(audit, notifications, prisma);
const health = new HealthService(config, prisma);
const observability = new ObservabilityService(config, logger);
const upload = multer({ storage: multer.memoryStorage() });
const uploadFile = upload.single('file') as unknown as RequestHandler;
const limit = createRateLimiter(config, logger);
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
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
    allowedHeaders: ['content-type', 'x-request-id', 'authorization'],
    exposedHeaders: ['x-request-id'],
    optionsSuccessStatus: 204,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

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
app.use('/api', api);

function platformAuth(handler: (authContext: AuthContext, request: Request, response: Response) => unknown) {
  return route(async (request, response) => handler(await auth.requirePlatformAdmin(request), request, response));
}

function tenantAuth(handler: (authContext: AuthContext, request: Request, response: Response) => unknown) {
  return route(async (request, response) => handler(await auth.requireTenantAdmin(request, request.params.tenantId), request, response));
}

api.get('/health', route(() => health.basic()));
api.get('/health/dependencies', route(() => health.dependencies()));

api.post(
  '/observability/client-events',
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

api.post('/admin/auth/login', limit('ADMIN_LOGIN'), route((request, response) => auth.login(validateDto(LoginDto, request.body), request, response)));
api.post('/admin/auth/password-reset/request', limit('PASSWORD_RESET'), route((request) => auth.requestPasswordReset(validateDto(ForgotPasswordDto, request.body))));
api.post('/admin/auth/password-reset/confirm', limit('PASSWORD_RESET'), route((request) => auth.resetPassword(validateDto(ResetPasswordDto, request.body))));
api.post('/admin/auth/logout', route((request, response) => auth.logout(request, response)));
api.get('/admin/auth/me', route(async (request) => auth.serializeContext(await auth.requireAdminContext(request, { requireCsrf: false }))));

api.post('/public/auth/register', limit('CUSTOMER_REGISTER'), route((request, response) => customerAuth.register(validateDto(CustomerRegisterDto, request.body), response)));
api.post('/public/auth/login', limit('CUSTOMER_LOGIN'), route((request, response) => customerAuth.login(validateDto(CustomerLoginDto, request.body), response)));
api.post('/public/auth/otp/request', limit('CUSTOMER_OTP_REQUEST'), route((request) => customerAuth.requestOtp(validateDto(CustomerOtpRequestDto, request.body))));
api.post('/public/auth/otp/confirm', limit('CUSTOMER_OTP_CONFIRM'), route((request, response) => customerAuth.confirmOtp(validateDto(CustomerOtpConfirmDto, request.body), response)));
api.post('/public/auth/password-reset/request', limit('CUSTOMER_OTP_REQUEST'), route((request) => customerAuth.requestOtp({ ...validateDto(CustomerOtpRequestDto, request.body), purpose: 'password_reset' })));
api.post('/public/auth/password-reset/confirm', limit('CUSTOMER_OTP_CONFIRM'), route((request) => customerAuth.confirmPasswordReset(validateDto(CustomerPasswordResetConfirmDto, request.body))));
api.post('/public/auth/logout', route((request, response) => customerAuth.logout(request, response)));
api.get('/public/auth/me', route((request) => customerAuth.me(request)));
api.delete('/public/auth/me', route((request, response) => customerAuth.deleteMe(request, response)));

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
api.get('/public/bookings/lookup', limit('PUBLIC_BOOKING_LOOKUP'), route((request) => booking.lookupBooking(validateDto(LookupBookingQueryDto, request.query))));
api.get('/public/tenants/:slug/services', route((request) => publicService.listTenantServices(request.params.slug)));
api.get('/public/tenants/:slug/experts', route((request) => publicService.listTenantExperts(request.params.slug)));
api.get('/public/tenants/:slug/available-slots', limit('PUBLIC_SLOT_LOOKUP'), route(async (request) => {
  await auth.requireCustomerContext(request);
  const query = validateDto(AvailableSlotsQueryDto, request.query);
  return scheduling.getAvailableSlots({
    tenantSlug: request.params.slug,
    serviceId: query.serviceId,
    expertId: query.expertId,
    date: query.date,
  });
}));
api.post('/public/tenants/:slug/bookings', limit('PUBLIC_BOOKING_CREATE'), route(async (request) => {
  const context = await auth.requireCustomerContext(request);
  return booking.createPublicBooking(request.params.slug, validateDto(CreatePublicBookingDto, request.body), sourceIp(request), {
    id: context.user.id,
    email: context.user.email,
    mobileNumber: context.user.mobileNumber,
  });
}));
api.get('/public/tenants/:slug', route((request) => publicService.getTenantBySlug(request.params.slug)));

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
api.get('/admin/platform/bookings/:bookingId', platformAuth((_authContext, request) => platformAdmin.getBooking(request.params.bookingId)));
api.post('/admin/platform/bookings/:bookingId/cancel', platformAuth((authContext, request) => platformAdmin.cancelBooking(request.params.bookingId, validateDto(BookingStatusNoteDto, request.body), authContext, sourceIp(request))));
api.get('/admin/platform/tenants/:id', platformAuth((_authContext, request) => platformAdmin.getTenant(request.params.id)));
api.patch('/admin/platform/tenants/:id', platformAuth((authContext, request) => platformAdmin.updateTenant(request.params.id, validateDto(UpdateTenantDto, request.body), authContext, sourceIp(request))));
api.post('/admin/platform/tenants/:id/activate', platformAuth((authContext, request) => platformAdmin.activateTenant(request.params.id, authContext, sourceIp(request))));
api.post('/admin/platform/tenants/:id/inactivate', platformAuth((authContext, request) => platformAdmin.setTenantStatus(request.params.id, TenantStatus.inactive, authContext, sourceIp(request))));
api.post('/admin/platform/tenants/:id/suspend', platformAuth((authContext, request) => platformAdmin.setTenantStatus(request.params.id, TenantStatus.suspended, authContext, sourceIp(request))));
api.post('/admin/platform/customers/anonymize', platformAuth((authContext, request) => platformAdmin.anonymizeCustomer(validateDto(AnonymizeCustomerDto, request.body), authContext, sourceIp(request))));
api.post('/admin/platform/tenants/:id/admins/first', platformAuth((authContext, request) => platformAdmin.createFirstTenantAdmin(request.params.id, validateDto(CreateTenantAdminDto, request.body), authContext, sourceIp(request))));

api.get('/admin/tenant/meta', route(async (request) => {
  const authContext = await auth.requireTenantAdmin(request);
  return {
    namespace: 'admin/tenant',
    authentication: 'secure-cookie-session',
    authorization: 'tenant_membership',
    user: authContext.user,
  };
}));
api.get('/admin/tenant/:tenantId/dashboard', tenantAuth((_authContext, request) => tenantAdmin.getDashboard(request.params.tenantId)));
api.get('/admin/tenant/:tenantId/profile', tenantAuth((_authContext, request) => tenantAdmin.getProfile(request.params.tenantId)));
api.patch('/admin/tenant/:tenantId/profile', tenantAuth((authContext, request) => tenantAdmin.updateProfile(request.params.tenantId, validateDto(UpdateTenantProfileDto, request.body), authContext, sourceIp(request))));
api.get('/admin/tenant/:tenantId/locations', tenantAuth((_authContext, request) => tenantAdmin.listLocations(request.params.tenantId)));
api.post('/admin/tenant/:tenantId/locations/primary', tenantAuth((authContext, request) => tenantAdmin.upsertPrimaryLocation(request.params.tenantId, validateDto(UpsertLocationDto, request.body), authContext, sourceIp(request))));
api.get('/admin/tenant/:tenantId/geocode', tenantAuth((_authContext, request) => tenantAdmin.geocodeLocation(request.params.tenantId, validateDto(GeocodeLocationQueryDto, request.query).address)));
api.post('/admin/tenant/:tenantId/logo', uploadFile, tenantAuth((authContext, request) => tenantAdmin.uploadTenantLogo(request.params.tenantId, request.file!, authContext, sourceIp(request))));
api.get('/admin/tenant/:tenantId/services', tenantAuth((_authContext, request) => tenantAdmin.listServices(request.params.tenantId)));
api.post('/admin/tenant/:tenantId/services', tenantAuth((authContext, request) => tenantAdmin.createService(request.params.tenantId, validateDto(CreateServiceDto, request.body), authContext, sourceIp(request))));
api.patch('/admin/tenant/:tenantId/services/:serviceId', tenantAuth((authContext, request) => tenantAdmin.updateService(request.params.tenantId, request.params.serviceId, validateDto(UpdateServiceDto, request.body), authContext, sourceIp(request))));
api.get('/admin/tenant/:tenantId/experts', tenantAuth((_authContext, request) => tenantAdmin.listExperts(request.params.tenantId)));
api.post('/admin/tenant/:tenantId/experts', tenantAuth((authContext, request) => tenantAdmin.createExpert(request.params.tenantId, validateDto(CreateExpertDto, request.body), authContext, sourceIp(request))));
api.patch('/admin/tenant/:tenantId/experts/:expertId', tenantAuth((authContext, request) => tenantAdmin.updateExpert(request.params.tenantId, request.params.expertId, validateDto(UpdateExpertDto, request.body), authContext, sourceIp(request))));
api.post('/admin/tenant/:tenantId/experts/:expertId/photo', uploadFile, tenantAuth((authContext, request) => tenantAdmin.uploadExpertPhoto(request.params.tenantId, request.params.expertId, request.file!, authContext, sourceIp(request))));
api.post('/admin/tenant/:tenantId/experts/:expertId/services', tenantAuth((authContext, request) => tenantAdmin.setExpertServices(request.params.tenantId, request.params.expertId, validateDto(SetExpertServicesDto, request.body), authContext, sourceIp(request))));
api.get('/admin/tenant/:tenantId/experts/:expertId/availability-rules', tenantAuth((_authContext, request) => tenantAdmin.listAvailabilityRules(request.params.tenantId, request.params.expertId)));
api.post('/admin/tenant/:tenantId/experts/:expertId/availability-rules', tenantAuth((authContext, request) => tenantAdmin.createAvailabilityRule(request.params.tenantId, request.params.expertId, validateDto(CreateAvailabilityRuleDto, request.body), authContext, sourceIp(request))));
api.delete('/admin/tenant/:tenantId/experts/:expertId/availability-rules/:ruleId', tenantAuth((authContext, request) => tenantAdmin.deleteAvailabilityRule(request.params.tenantId, request.params.expertId, request.params.ruleId, authContext, sourceIp(request))));
api.get('/admin/tenant/:tenantId/experts/:expertId/availability-exceptions', tenantAuth((_authContext, request) => tenantAdmin.listAvailabilityExceptions(request.params.tenantId, request.params.expertId)));
api.post('/admin/tenant/:tenantId/experts/:expertId/availability-exceptions', tenantAuth((authContext, request) => tenantAdmin.createAvailabilityException(request.params.tenantId, request.params.expertId, validateDto(CreateAvailabilityExceptionDto, request.body), authContext, sourceIp(request))));
api.delete('/admin/tenant/:tenantId/experts/:expertId/availability-exceptions/:exceptionId', tenantAuth((authContext, request) => tenantAdmin.deleteAvailabilityException(request.params.tenantId, request.params.expertId, request.params.exceptionId, authContext, sourceIp(request))));
api.get('/admin/tenant/:tenantId/bookings', tenantAuth((_authContext, request) => tenantAdmin.listBookings(request.params.tenantId, validateDto(ListBookingsQueryDto, request.query))));
api.get('/admin/tenant/:tenantId/bookings/:bookingId', tenantAuth((_authContext, request) => tenantAdmin.getBooking(request.params.tenantId, request.params.bookingId)));
api.post('/admin/tenant/:tenantId/bookings/:bookingId/cancel', tenantAuth((authContext, request) => tenantAdmin.cancelBooking(request.params.tenantId, request.params.bookingId, validateDto(BookingStatusNoteDto, request.body), authContext, sourceIp(request))));
api.post('/admin/tenant/:tenantId/bookings/:bookingId/complete', tenantAuth((authContext, request) => tenantAdmin.completeBooking(request.params.tenantId, request.params.bookingId, validateDto(BookingStatusNoteDto, request.body), authContext, sourceIp(request))));
api.post('/admin/tenant/:tenantId/bookings/:bookingId/no-show', tenantAuth((authContext, request) => tenantAdmin.markBookingNoShow(request.params.tenantId, request.params.bookingId, validateDto(BookingStatusNoteDto, request.body), authContext, sourceIp(request))));

api.use((_request, _response, next) => next(new HttpException('Route not found', 404)));

app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
  const status = error instanceof HttpException ? error.getStatus() : 500;
  const exception = error instanceof Error ? error : new InternalServerErrorException('Unknown error');
  if (status >= 500) {
    observability.captureException(exception, {
      method: request.method,
      path: request.originalUrl,
      requestId: requestIdFrom(request),
    });
  }

  const payload = error instanceof HttpException ? error.getResponse() : { message: 'Internal server error' };
  response.status(status).json(typeof payload === 'string' ? { message: payload } : payload);
});

const port = config.get<number>('API_PORT', 4000);

if (require.main === module) {
  app.listen(port, () => {
    logger.event('info', 'api.started', `Neara Express API listening on ${port}`, { port });
  });
}

export default app;
module.exports = app;
module.exports.default = app;
