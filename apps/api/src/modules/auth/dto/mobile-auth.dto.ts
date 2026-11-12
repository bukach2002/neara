import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class MobileDeviceDto {
  @ApiProperty({ example: 'device-7f1c2b', description: 'Stable, opaque identifier chosen by the app installation' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  id!: string;

  @ApiPropertyOptional({ example: 'Buffy iPhone' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: ['ios', 'android', 'web', 'unknown'] })
  @IsOptional()
  @IsIn(['ios', 'android', 'web', 'unknown'])
  platform?: 'ios' | 'android' | 'web' | 'unknown';
}

export class MobileLoginDto {
  @ApiProperty({ example: 'owner@studio.example' })
  @IsString()
  @MaxLength(320)
  identifier!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ type: MobileDeviceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MobileDeviceDto)
  device?: MobileDeviceDto;

  @ApiPropertyOptional({ description: 'TOTP code, required when MFA is enabled' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  totpCode?: string;
}

export class MobileRefreshDto {
  @ApiProperty()
  @IsString()
  @MaxLength(512)
  refreshToken!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  deviceId!: string;
}

export class MobileLogoutDto {
  @ApiProperty()
  @IsString()
  @MaxLength(512)
  refreshToken!: string;
}

export class MobilePasswordResetRequestDto {
  @ApiProperty({ example: 'owner@studio.example' })
  @IsString()
  @MaxLength(320)
  identifier!: string;
}

export class MobilePasswordResetConfirmDto {
  @ApiProperty()
  @IsString()
  @MaxLength(320)
  identifier!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
