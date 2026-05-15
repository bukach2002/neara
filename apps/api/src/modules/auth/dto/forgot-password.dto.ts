import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'tenant.admin@neara.local' })
  @IsEmail()
  email!: string;
}
