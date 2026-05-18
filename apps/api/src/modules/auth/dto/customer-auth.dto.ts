import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CustomerRegisterDto {
  @ApiProperty({ example: 'Customer One' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  mobileNumber?: string;

  @ApiProperty({ minLength: 8, example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}

export class CustomerLoginDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsString()
  identifier!: string;

  @ApiProperty({ minLength: 8, example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}

export class CustomerOtpRequestDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsString()
  identifier!: string;

  @ApiPropertyOptional({ enum: ['login', 'password_reset'] })
  @IsOptional()
  @IsIn(['login', 'password_reset'])
  purpose?: 'login' | 'password_reset';

  @ApiPropertyOptional({ enum: ['email', 'sms', 'whatsapp'] })
  @IsOptional()
  @IsIn(['email', 'sms', 'whatsapp'])
  channel?: 'email' | 'sms' | 'whatsapp';
}

export class CustomerOtpConfirmDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsString()
  identifier!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;

  @ApiProperty({ enum: ['login', 'password_reset'] })
  @IsIn(['login', 'password_reset'])
  purpose!: 'login' | 'password_reset';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}

export class CustomerPasswordResetConfirmDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsString()
  identifier!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;

  @ApiProperty({ minLength: 8, example: 'NewChangeMe123!' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
