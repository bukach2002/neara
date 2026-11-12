import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'platform.admin@neara.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ description: 'TOTP code, required when MFA is enabled for the account' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  totpCode?: string;
}
