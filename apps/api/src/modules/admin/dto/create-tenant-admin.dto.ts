import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTenantAdminDto {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Tenant Owner' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Optional temporary password. If omitted, one is generated.' })
  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword?: string;
}
