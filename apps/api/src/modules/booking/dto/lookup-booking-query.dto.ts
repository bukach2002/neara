import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class LookupBookingQueryDto {
  @ApiProperty({ example: 'NEAR-7A2K' })
  @IsString()
  @MaxLength(32)
  reference!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;
}
