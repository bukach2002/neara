import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class GeocodeLocationQueryDto {
  @ApiProperty({ example: '12 MG Road, Indiranagar, Bengaluru' })
  @IsString()
  @MinLength(3)
  @MaxLength(320)
  address!: string;
}
