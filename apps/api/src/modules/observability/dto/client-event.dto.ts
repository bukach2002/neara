import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ClientEventDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  event!: string;

  @ApiProperty({ maxLength: 300 })
  @IsString()
  @MaxLength(300)
  path!: string;

  @ApiPropertyOptional({ enum: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'] })
  @IsOptional()
  @IsIn(['GET', 'POST', 'PATCH', 'DELETE', 'PUT'])
  method?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  status?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120_000)
  durationMs?: number;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  requestId?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ maxLength: 240 })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  message?: string;
}
