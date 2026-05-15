import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BookingService } from '../booking/booking.service';
import { CreatePublicBookingDto } from '../booking/dto/create-public-booking.dto';
import { LookupBookingQueryDto } from '../booking/dto/lookup-booking-query.dto';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { SchedulingService } from '../scheduling/scheduling.service';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { PlaceAutocompleteQueryDto } from './dto/place-autocomplete-query.dto';
import { ReverseGeocodeQueryDto } from './dto/reverse-geocode-query.dto';
import { SearchTenantsQueryDto } from './dto/search-tenants-query.dto';
import { PublicService } from './public.service';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly publicService: PublicService,
    private readonly schedulingService: SchedulingService,
  ) {}

  @Get('meta')
  @ApiOkResponse({ description: 'Public API namespace metadata' })
  meta() {
    return {
      namespace: 'public',
      authentication: 'anonymous',
      mvpGuardrails: {
        customerAccounts: false,
        payments: false,
        rescheduling: false,
      },
    };
  }

  @Get('categories')
  @ApiOkResponse({ description: 'List active public categories' })
  categories() {
    return this.publicService.listCategories();
  }

  @Get('tenants')
  @RateLimit('PUBLIC_SEARCH')
  @ApiOkResponse({ description: 'Search active public tenants' })
  searchTenants(@Query() query: SearchTenantsQueryDto) {
    return this.publicService.searchTenants(query);
  }

  @Get('reverse-geocode')
  @RateLimit('PUBLIC_SEARCH')
  @ApiOkResponse({ description: 'Resolve browser coordinates into a readable locality label' })
  reverseGeocode(@Query() query: ReverseGeocodeQueryDto) {
    return this.publicService.reverseGeocode(query.latitude, query.longitude);
  }

  @Get('place-autocomplete')
  @RateLimit('PUBLIC_SEARCH')
  @ApiOkResponse({ description: 'Suggest Indian localities and places for search' })
  placeAutocomplete(@Query() query: PlaceAutocompleteQueryDto) {
    return this.publicService.placeAutocomplete(query.input);
  }

  @Get('tenants/:slug')
  @ApiOkResponse({ description: 'Get active public tenant by slug' })
  tenant(@Param('slug') slug: string) {
    return this.publicService.getTenantBySlug(slug);
  }

  @Get('tenants/:slug/services')
  @ApiOkResponse({ description: 'List active public services for a tenant' })
  tenantServices(@Param('slug') slug: string) {
    return this.publicService.listTenantServices(slug);
  }

  @Get('tenants/:slug/experts')
  @ApiOkResponse({ description: 'List active public experts for a tenant' })
  tenantExperts(@Param('slug') slug: string) {
    return this.publicService.listTenantExperts(slug);
  }

  @Get('tenants/:slug/available-slots')
  @RateLimit('PUBLIC_SLOT_LOOKUP')
  @ApiOkResponse({ description: 'List available slots for a service and optional expert' })
  availableSlots(@Param('slug') slug: string, @Query() query: AvailableSlotsQueryDto) {
    return this.schedulingService.getAvailableSlots({
      tenantSlug: slug,
      serviceId: query.serviceId,
      expertId: query.expertId,
      date: query.date,
    });
  }

  @Post('tenants/:slug/bookings')
  @RateLimit('PUBLIC_BOOKING_CREATE')
  @ApiOkResponse({ description: 'Create an instantly confirmed public booking' })
  createBooking(@Param('slug') slug: string, @Body() dto: CreatePublicBookingDto, @Req() request: Request) {
    return this.bookingService.createPublicBooking(slug, dto, request.ip);
  }

  @Get('bookings/lookup')
  @RateLimit('PUBLIC_BOOKING_LOOKUP')
  @ApiOkResponse({ description: 'Look up booking by reference and phone' })
  lookupBooking(@Query() query: LookupBookingQueryDto) {
    return this.bookingService.lookupBooking(query);
  }
}
