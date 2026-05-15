import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PlaceAutocompleteQueryDto {
  @ApiProperty({ example: 'Pimple Saudagar' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  input!: string;
}
