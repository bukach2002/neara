import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client';
import type { Request } from 'express';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { AuthContext } from '../auth/types';
import { AnonymizeCustomerDto } from './dto/anonymize-customer.dto';
import { BookingStatusNoteDto } from './dto/booking-status-note.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListLogsQueryDto } from './dto/list-logs-query.dto';
import { ListPlatformBookingsQueryDto } from './dto/list-platform-bookings-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PlatformAdminService } from './platform-admin.service';

@ApiTags('admin/platform')
@ApiCookieAuth('neara.sid')
@UseGuards(PlatformAdminGuard)
@Controller('admin/platform')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('meta')
  @ApiOkResponse({ description: 'Platform admin API namespace metadata' })
  meta(@CurrentAuth() auth: AuthContext) {
    return {
      namespace: 'admin/platform',
      authentication: 'secure-cookie-session',
      authorization: 'platform_admin',
      user: auth.user,
    };
  }

  @Get('categories')
  @ApiOkResponse({ description: 'List platform categories' })
  listCategories() {
    return this.platformAdminService.listCategories();
  }

  @Post('categories')
  @ApiOkResponse({ description: 'Create a platform category' })
  createCategory(@Body() dto: CreateCategoryDto, @CurrentAuth() auth: AuthContext, @Req() request: Request) {
    return this.platformAdminService.createCategory(dto, auth, request.ip);
  }

  @Patch('categories/:id')
  @ApiOkResponse({ description: 'Update a platform category' })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.platformAdminService.updateCategory(id, dto, auth, request.ip);
  }

  @Get('tenants')
  @ApiOkResponse({ description: 'List tenants' })
  listTenants() {
    return this.platformAdminService.listTenants();
  }

  @Post('tenants')
  @ApiOkResponse({ description: 'Create a draft tenant' })
  createTenant(@Body() dto: CreateTenantDto, @CurrentAuth() auth: AuthContext, @Req() request: Request) {
    return this.platformAdminService.createTenant(dto, auth, request.ip);
  }

  @Get('audit-logs')
  @ApiOkResponse({ description: 'List platform audit logs' })
  listAuditLogs(@Query() query: ListLogsQueryDto) {
    return this.platformAdminService.listAuditLogs(query);
  }

  @Get('notification-logs')
  @ApiOkResponse({ description: 'List platform notification logs' })
  listNotificationLogs(@Query() query: ListLogsQueryDto) {
    return this.platformAdminService.listNotificationLogs(query);
  }

  @Get('bookings')
  @ApiOkResponse({ description: 'Lookup bookings across tenants' })
  listBookings(@Query() query: ListPlatformBookingsQueryDto) {
    return this.platformAdminService.listBookings(query);
  }

  @Get('bookings/:bookingId')
  @ApiOkResponse({ description: 'Get platform booking detail' })
  getBooking(@Param('bookingId') bookingId: string) {
    return this.platformAdminService.getBooking(bookingId);
  }

  @Post('bookings/:bookingId/cancel')
  @ApiOkResponse({ description: 'Cancel a booking as platform admin' })
  cancelBooking(
    @Param('bookingId') bookingId: string,
    @Body() dto: BookingStatusNoteDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.platformAdminService.cancelBooking(bookingId, dto, auth, request.ip);
  }

  @Get('tenants/:id')
  @ApiOkResponse({ description: 'Get tenant detail' })
  getTenant(@Param('id') id: string) {
    return this.platformAdminService.getTenant(id);
  }

  @Patch('tenants/:id')
  @ApiOkResponse({ description: 'Update tenant detail' })
  updateTenant(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.platformAdminService.updateTenant(id, dto, auth, request.ip);
  }

  @Post('tenants/:id/activate')
  @ApiOkResponse({ description: 'Activate a tenant after MVP requirements are satisfied' })
  activateTenant(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @Req() request: Request) {
    return this.platformAdminService.activateTenant(id, auth, request.ip);
  }

  @Post('tenants/:id/inactivate')
  @ApiOkResponse({ description: 'Set a tenant inactive' })
  inactivateTenant(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @Req() request: Request) {
    return this.platformAdminService.setTenantStatus(id, TenantStatus.inactive, auth, request.ip);
  }

  @Post('tenants/:id/suspend')
  @ApiOkResponse({ description: 'Suspend a tenant' })
  suspendTenant(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @Req() request: Request) {
    return this.platformAdminService.setTenantStatus(id, TenantStatus.suspended, auth, request.ip);
  }

  @Post('customers/anonymize')
  @ApiOkResponse({ description: 'Anonymize customer personal data across operational records' })
  anonymizeCustomer(@Body() dto: AnonymizeCustomerDto, @CurrentAuth() auth: AuthContext, @Req() request: Request) {
    return this.platformAdminService.anonymizeCustomer(dto, auth, request.ip);
  }

  @Post('tenants/:id/admins/first')
  @ApiOkResponse({ description: 'Create the first tenant admin owner' })
  createFirstTenantAdmin(
    @Param('id') id: string,
    @Body() dto: CreateTenantAdminDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.platformAdminService.createFirstTenantAdmin(id, dto, auth, request.ip);
  }
}
