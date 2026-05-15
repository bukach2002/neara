import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AvailabilityExceptionType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateAvailabilityExceptionDto {
  @ApiProperty({ enum: AvailabilityExceptionType })
  @IsEnum(AvailabilityExceptionType)
  type!: AvailabilityExceptionType;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  startsOn!: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  endsOn!: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startLocalTime?: string;

  @ApiPropertyOptional({ example: '14:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endLocalTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
