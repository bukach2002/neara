import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { TenantAdminGuard } from '../auth/guards/tenant-admin.guard';
import { AuthContext } from '../auth/types';
import { BookingStatusNoteDto } from './dto/booking-status-note.dto';
import { CreateAvailabilityExceptionDto } from './dto/create-availability-exception.dto';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { CreateExpertDto } from './dto/create-expert.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { GeocodeLocationQueryDto } from './dto/geocode-location-query.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { SetExpertServicesDto } from './dto/set-expert-services.dto';
import { UpdateExpertDto } from './dto/update-expert.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { UpsertLocationDto } from './dto/upsert-location.dto';
import { TenantAdminService } from './tenant-admin.service';

@ApiTags('admin/tenant')
@ApiCookieAuth('neara.sid')
@UseGuards(TenantAdminGuard)
@Controller('admin/tenant')
export class TenantAdminController {
  constructor(private readonly tenantAdminService: TenantAdminService) {}

  @Get('meta')
  @ApiOkResponse({ description: 'Tenant admin API namespace metadata' })
  meta(@CurrentAuth() auth: AuthContext) {
    return {
      namespace: 'admin/tenant',
      authentication: 'secure-cookie-session',
      authorization: 'tenant_membership',
      user: auth.user,
    };
  }

  @Get(':tenantId/dashboard')
  @ApiOkResponse({ description: 'Tenant dashboard metrics' })
  dashboard(@Param('tenantId') tenantId: string) {
    return this.tenantAdminService.getDashboard(tenantId);
  }

  @Get(':tenantId/profile')
  @ApiOkResponse({ description: 'Tenant profile' })
  profile(@Param('tenantId') tenantId: string) {
    return this.tenantAdminService.getProfile(tenantId);
  }

  @Patch(':tenantId/profile')
  @ApiOkResponse({ description: 'Update tenant profile' })
  updateProfile(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantProfileDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.updateProfile(tenantId, dto, auth, request.ip);
  }

  @Get(':tenantId/locations')
  @ApiOkResponse({ description: 'List tenant locations' })
  locations(@Param('tenantId') tenantId: string) {
    return this.tenantAdminService.listLocations(tenantId);
  }

  @Post(':tenantId/locations/primary')
  @ApiOkResponse({ description: 'Create or update the primary location' })
  upsertPrimaryLocation(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpsertLocationDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.upsertPrimaryLocation(tenantId, dto, auth, request.ip);
  }

  @Get(':tenantId/geocode')
  @ApiOkResponse({ description: 'Geocode an address for primary location capture' })
  geocodeLocation(@Param('tenantId') tenantId: string, @Query() query: GeocodeLocationQueryDto) {
    return this.tenantAdminService.geocodeLocation(tenantId, query.address);
  }

  @Post(':tenantId/logo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOkResponse({ description: 'Upload tenant logo image' })
  uploadTenantLogo(
    @Param('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.uploadTenantLogo(tenantId, file, auth, request.ip);
  }

  @Get(':tenantId/services')
  @ApiOkResponse({ description: 'List services' })
  services(@Param('tenantId') tenantId: string) {
    return this.tenantAdminService.listServices(tenantId);
  }

  @Post(':tenantId/services')
  @ApiOkResponse({ description: 'Create service' })
  createService(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateServiceDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.createService(tenantId, dto, auth, request.ip);
  }

  @Patch(':tenantId/services/:serviceId')
  @ApiOkResponse({ description: 'Update service' })
  updateService(
    @Param('tenantId') tenantId: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateServiceDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.updateService(tenantId, serviceId, dto, auth, request.ip);
  }

  @Get(':tenantId/experts')
  @ApiOkResponse({ description: 'List experts' })
  experts(@Param('tenantId') tenantId: string) {
    return this.tenantAdminService.listExperts(tenantId);
  }

  @Post(':tenantId/experts')
  @ApiOkResponse({ description: 'Create expert' })
  createExpert(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateExpertDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.createExpert(tenantId, dto, auth, request.ip);
  }

  @Patch(':tenantId/experts/:expertId')
  @ApiOkResponse({ description: 'Update expert' })
  updateExpert(
    @Param('tenantId') tenantId: string,
    @Param('expertId') expertId: string,
    @Body() dto: UpdateExpertDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.updateExpert(tenantId, expertId, dto, auth, request.ip);
  }

  @Post(':tenantId/experts/:expertId/photo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOkResponse({ description: 'Upload expert photo image' })
  uploadExpertPhoto(
    @Param('tenantId') tenantId: string,
    @Param('expertId') expertId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.uploadExpertPhoto(tenantId, expertId, file, auth, request.ip);
  }

  @Post(':tenantId/experts/:expertId/services')
  @ApiOkResponse({ description: 'Replace expert service assignments' })
  setExpertServices(
    @Param('tenantId') tenantId: string,
    @Param('expertId') expertId: string,
    @Body() dto: SetExpertServicesDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.setExpertServices(tenantId, expertId, dto, auth, request.ip);
  }

  @Get(':tenantId/experts/:expertId/availability-rules')
  @ApiOkResponse({ description: 'List recurring availability rules' })
  availabilityRules(@Param('tenantId') tenantId: string, @Param('expertId') expertId: string) {
    return this.tenantAdminService.listAvailabilityRules(tenantId, expertId);
  }

  @Post(':tenantId/experts/:expertId/availability-rules')
  @ApiOkResponse({ description: 'Create recurring availability rule' })
  createAvailabilityRule(
    @Param('tenantId') tenantId: string,
    @Param('expertId') expertId: string,
    @Body() dto: CreateAvailabilityRuleDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.createAvailabilityRule(tenantId, expertId, dto, auth, request.ip);
  }

  @Delete(':tenantId/experts/:expertId/availability-rules/:ruleId')
  @ApiOkResponse({ description: 'Archive recurring availability rule' })
  deleteAvailabilityRule(
    @Param('tenantId') tenantId: string,
    @Param('expertId') expertId: string,
    @Param('ruleId') ruleId: string,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.deleteAvailabilityRule(tenantId, expertId, ruleId, auth, request.ip);
  }

  @Get(':tenantId/experts/:expertId/availability-exceptions')
  @ApiOkResponse({ description: 'List availability exceptions' })
  availabilityExceptions(@Param('tenantId') tenantId: string, @Param('expertId') expertId: string) {
    return this.tenantAdminService.listAvailabilityExceptions(tenantId, expertId);
  }

  @Post(':tenantId/experts/:expertId/availability-exceptions')
  @ApiOkResponse({ description: 'Create block or override availability exception' })
  createAvailabilityException(
    @Param('tenantId') tenantId: string,
    @Param('expertId') expertId: string,
    @Body() dto: CreateAvailabilityExceptionDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.createAvailabilityException(tenantId, expertId, dto, auth, request.ip);
  }

  @Delete(':tenantId/experts/:expertId/availability-exceptions/:exceptionId')
  @ApiOkResponse({ description: 'Delete availability exception' })
  deleteAvailabilityException(
    @Param('tenantId') tenantId: string,
    @Param('expertId') expertId: string,
    @Param('exceptionId') exceptionId: string,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.deleteAvailabilityException(tenantId, expertId, exceptionId, auth, request.ip);
  }

  @Get(':tenantId/bookings')
  @ApiOkResponse({ description: 'List tenant bookings' })
  bookings(@Param('tenantId') tenantId: string, @Query() query: ListBookingsQueryDto) {
    return this.tenantAdminService.listBookings(tenantId, query);
  }

  @Get(':tenantId/bookings/:bookingId')
  @ApiOkResponse({ description: 'Get booking detail' })
  booking(@Param('tenantId') tenantId: string, @Param('bookingId') bookingId: string) {
    return this.tenantAdminService.getBooking(tenantId, bookingId);
  }

  @Post(':tenantId/bookings/:bookingId/cancel')
  @ApiOkResponse({ description: 'Cancel a confirmed booking' })
  cancelBooking(
    @Param('tenantId') tenantId: string,
    @Param('bookingId') bookingId: string,
    @Body() dto: BookingStatusNoteDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.cancelBooking(tenantId, bookingId, dto, auth, request.ip);
  }

  @Post(':tenantId/bookings/:bookingId/complete')
  @ApiOkResponse({ description: 'Mark a confirmed booking complete' })
  completeBooking(
    @Param('tenantId') tenantId: string,
    @Param('bookingId') bookingId: string,
    @Body() dto: BookingStatusNoteDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.completeBooking(tenantId, bookingId, dto, auth, request.ip);
  }

  @Post(':tenantId/bookings/:bookingId/no-show')
  @ApiOkResponse({ description: 'Mark a confirmed booking no-show' })
  markBookingNoShow(
    @Param('tenantId') tenantId: string,
    @Param('bookingId') bookingId: string,
    @Body() dto: BookingStatusNoteDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ) {
    return this.tenantAdminService.markBookingNoShow(tenantId, bookingId, dto, auth, request.ip);
  }
}
