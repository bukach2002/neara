import { Injectable, NotFoundException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TenantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchTenantsQueryDto } from './dto/search-tenants-query.dto';

type RankedTenantRow = {
  id: string;
  distanceKm: number | null;
  textScore: number;
};

type PlaceSuggestion = {
  description: string;
  placeId: string;
  latitude: number;
  longitude: number;
};

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  listCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
      },
    });
  }

  async searchTenants(query: SearchTenantsQueryDto) {
    const radiusKm = query.radiusKm ?? 10;
    const take = query.take ?? 20;
    const keyword = query.keyword?.trim();
    const hasCoordinates = query.latitude !== undefined && query.longitude !== undefined;
    const locality = hasCoordinates ? undefined : query.locality?.trim();

    const rankedRows = await this.searchTenantIds({
      keyword,
      category: query.category,
      locality,
      latitude: query.latitude,
      longitude: query.longitude,
      radiusKm,
      take,
    });
    const rankById = new Map(rankedRows.map((row, index) => [row.id, { ...row, index }]));

    if (rankedRows.length === 0) {
      return {
        items: [],
        meta: {
          radiusKm,
          distanceUnit: 'km',
          launchCountry: 'IN',
        },
      };
    }

    const tenants = await this.prisma.tenant.findMany({
      where: {
        id: { in: rankedRows.map((row) => row.id) },
      },
      include: {
        primaryCategory: true,
        locations: { where: { isActive: true, archivedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        services: {
          where: { isActive: true, isPublic: true, archivedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, durationMinutes: true, displayPriceAmount: true, displayPriceCurrency: true },
        },
        _count: {
          select: {
            experts: { where: { isActive: true, archivedAt: null } },
            services: { where: { isActive: true, isPublic: true, archivedAt: null } },
          },
        },
      },
    });

    const ranked = tenants
      .map((tenant) => {
        const location = tenant.locations[0];
        const rank = rankById.get(tenant.id);
        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          description: tenant.description,
          logoUrl: tenant.logoUrl,
          category: tenant.primaryCategory,
          location,
          distanceKm: rank?.distanceKm ?? null,
          services: tenant.services,
          counts: tenant._count,
          textScore: rank?.textScore ?? 0,
          availabilityState: tenant._count.experts > 0 && tenant._count.services > 0 ? 'availability_configured' : 'no_slots_currently_available',
        };
      })
      .sort((left, right) => {
        const leftRank = rankById.get(left.id);
        const rightRank = rankById.get(right.id);
        return (leftRank?.index ?? 0) - (rightRank?.index ?? 0);
      });

    return {
      items: ranked,
      meta: {
        radiusKm,
        distanceUnit: 'km',
        launchCountry: 'IN',
      },
    };
  }

  async getTenantBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, status: TenantStatus.active, archivedAt: null },
      include: {
        primaryCategory: true,
        locations: { where: { isActive: true, archivedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        services: {
          where: { isActive: true, isPublic: true, archivedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            expertServices: {
              where: { isActive: true, expert: { isActive: true, archivedAt: null } },
              include: { expert: true },
            },
          },
        },
        experts: {
          where: { isActive: true, archivedAt: null },
          orderBy: { displayName: 'asc' },
          include: {
            expertServices: {
              where: { isActive: true, service: { isActive: true, isPublic: true, archivedAt: null } },
              include: { service: true },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async reverseGeocode(latitude: number, longitude: number) {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY', '');
    if (!apiKey) {
      throw new BadRequestException('Google Maps API key is not configured');
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('result_type', 'sublocality|locality|administrative_area_level_3|postal_code');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      throw new BadRequestException('Reverse geocoding request failed');
    }

    const payload = (await response.json()) as {
      status: string;
      error_message?: string;
      results?: Array<{
        formatted_address: string;
        address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
      }>;
    };

    const result = payload.results?.[0];
    if (payload.status !== 'OK' || !result) {
      throw new BadRequestException(payload.error_message || 'No reverse geocoding result found');
    }

    const component = (type: string) => result.address_components.find((item) => item.types.includes(type));
    const locality =
      component('sublocality_level_1')?.long_name ??
      component('sublocality')?.long_name ??
      component('neighborhood')?.long_name ??
      component('locality')?.long_name ??
      component('administrative_area_level_3')?.long_name;
    const city = component('locality')?.long_name ?? component('administrative_area_level_3')?.long_name;

    return {
      formattedAddress: result.formatted_address,
      locality: locality ?? city ?? result.formatted_address,
      city,
      state: component('administrative_area_level_1')?.long_name,
      postalCode: component('postal_code')?.long_name,
      countryCode: component('country')?.short_name,
    };
  }

  async placeAutocomplete(input: string) {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY', '');
    if (!apiKey) {
      throw new BadRequestException('Google Maps API key is not configured');
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input.trim());
    url.searchParams.set('components', 'country:in');
    url.searchParams.set('types', 'geocode');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      throw new BadRequestException('Place autocomplete request failed');
    }

    const payload = (await response.json()) as {
      status: string;
      error_message?: string;
      predictions?: Array<{ description: string; place_id: string }>;
    };

    if (payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
      throw new BadRequestException(payload.error_message || 'Place autocomplete failed');
    }

    const predictions = (payload.predictions ?? []).slice(0, 5);
    const suggestions = await Promise.all(
      predictions.map(async (prediction): Promise<PlaceSuggestion | null> => {
        const details = await this.placeDetails(prediction.place_id, apiKey);
        if (!details) return null;
        return {
          description: prediction.description,
          placeId: prediction.place_id,
          latitude: details.latitude,
          longitude: details.longitude,
        };
      }),
    );

    return { items: suggestions.filter((suggestion): suggestion is PlaceSuggestion => Boolean(suggestion)) };
  }

  async listTenantServices(slug: string) {
    const tenant = await this.getTenantBySlug(slug);
    return tenant.services.map((service) => ({
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
      durationMinutes: service.durationMinutes,
      displayPriceAmount: service.displayPriceAmount,
      displayPriceCurrency: service.displayPriceCurrency,
      experts: service.expertServices.map((assignment) => ({
        id: assignment.expert.id,
        displayName: assignment.expert.displayName,
        shortBio: assignment.expert.shortBio,
        photoUrl: assignment.expert.photoUrl,
      })),
    }));
  }

  async listTenantExperts(slug: string) {
    const tenant = await this.getTenantBySlug(slug);
    return tenant.experts.map((expert) => ({
      id: expert.id,
      displayName: expert.displayName,
      shortBio: expert.shortBio,
      photoUrl: expert.photoUrl,
      services: expert.expertServices.map((assignment) => ({
        id: assignment.service.id,
        name: assignment.service.name,
        durationMinutes: assignment.service.durationMinutes,
      })),
    }));
  }

  private searchTenantIds(input: {
    keyword?: string;
    category?: string;
    locality?: string;
    latitude?: number;
    longitude?: number;
    radiusKm: number;
    take: number;
  }) {
    const hasCoordinates = input.latitude !== undefined && input.longitude !== undefined;
    const keyword = input.keyword;

    return this.prisma.$queryRaw<RankedTenantRow[]>`
      SELECT
        t.id::text AS "id",
        ${
          hasCoordinates
            ? Prisma.sql`
              MIN(
                ST_DistanceSphere(
                  ST_MakePoint(l."longitude"::float8, l."latitude"::float8),
                  ST_MakePoint(${input.longitude}, ${input.latitude})
                ) / 1000
              )::float8`
            : Prisma.sql`NULL::float8`
        } AS "distanceKm",
        ${
          keyword
            ? Prisma.sql`
              MAX(
                GREATEST(
                  similarity(t."name", ${keyword}),
                  similarity(COALESCE(t."description", ''), ${keyword}),
                  similarity(COALESCE(s."name", ''), ${keyword}),
                  similarity(COALESCE(e."displayName", ''), ${keyword})
                )
              )::float8`
            : Prisma.sql`0::float8`
        } AS "textScore"
      FROM "tenants" t
      JOIN "categories" c ON c.id = t."primaryCategoryId"
      JOIN "locations" l ON l."tenantId" = t.id
        AND l."isActive" = true
        AND l."archivedAt" IS NULL
      LEFT JOIN "services" s ON s."tenantId" = t.id
        AND s."isActive" = true
        AND s."isPublic" = true
        AND s."archivedAt" IS NULL
      LEFT JOIN "experts" e ON e."tenantId" = t.id
        AND e."isActive" = true
        AND e."archivedAt" IS NULL
      WHERE t."status" = ${TenantStatus.active}::"TenantStatus"
        AND t."archivedAt" IS NULL
        AND c."isActive" = true
        ${input.category ? Prisma.sql`AND c."slug" = ${input.category}` : Prisma.empty}
        ${input.locality ? Prisma.sql`AND l."locality" ILIKE ${`%${input.locality}%`}` : Prisma.empty}
        ${
          keyword
            ? Prisma.sql`
              AND (
                t."name" % ${keyword}
                OR COALESCE(t."description", '') % ${keyword}
                OR COALESCE(s."name", '') % ${keyword}
                OR COALESCE(e."displayName", '') % ${keyword}
                OR t."name" ILIKE ${`%${keyword}%`}
                OR COALESCE(t."description", '') ILIKE ${`%${keyword}%`}
                OR COALESCE(s."name", '') ILIKE ${`%${keyword}%`}
                OR COALESCE(e."displayName", '') ILIKE ${`%${keyword}%`}
              )`
            : Prisma.empty
        }
        ${
          hasCoordinates
            ? Prisma.sql`
              AND ST_DWithin(
                ST_MakePoint(l."longitude"::float8, l."latitude"::float8)::geography,
                ST_MakePoint(${input.longitude}, ${input.latitude})::geography,
                ${input.radiusKm * 1000}
              )`
            : Prisma.empty
        }
      GROUP BY t.id, t."name"
      ORDER BY "textScore" DESC, "distanceKm" ASC NULLS LAST, t."name" ASC
      LIMIT ${input.take}
    `;
  }

  private async placeDetails(placeId: string, apiKey: string) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'geometry');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url);
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      status: string;
      result?: { geometry?: { location?: { lat: number; lng: number } } };
    };
    const location = payload.result?.geometry?.location;
    if (payload.status !== 'OK' || !location) return null;
    return { latitude: location.lat, longitude: location.lng };
  }
}
