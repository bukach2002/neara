import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertLocationDto {
  @ApiProperty({ example: 'Main Studio' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '12 MG Road' })
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  addressLine!: string;

  @ApiProperty({ example: 'Indiranagar' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  locality!: string;

  @ApiProperty({ example: 'Bengaluru' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ default: 'IN' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @ApiProperty({ example: 12.9784 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 77.6408 })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
