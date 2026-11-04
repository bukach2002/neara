import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class TenantSignupDto {
  @ApiProperty({ example: 'Near Beauty Studio' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessName!: string;

  @ApiProperty({ example: 'near-beauty-studio' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must use lowercase letters, numbers and single hyphens',
  })
  slug!: string;

  @ApiProperty({ example: 'Asha Menon' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName!: string;

  @ApiProperty({ example: 'owner@nearbeauty.example' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}
