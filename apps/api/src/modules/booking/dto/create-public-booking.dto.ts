import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreatePublicBookingDto {
  @ApiProperty()
  @IsUUID()
  serviceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  expertId?: string;

  @ApiProperty({ description: 'UTC ISO timestamp from available-slots response' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: 'Vishal Kumar' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  customerPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNote?: string;

  @ApiProperty({ description: 'Required privacy and booking-contact consent' })
  @IsBoolean()
  consentAccepted!: boolean;
}
