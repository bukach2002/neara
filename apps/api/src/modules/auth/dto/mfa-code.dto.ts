import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class MfaCodeDto {
  @ApiProperty({ example: '123456', description: 'Six digit TOTP code from the authenticator app' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
