import { ApiProperty } from '@nestjs/swagger';
import { FileType } from '../../../../domain/file.js';

export class FileResponseDto {
  @ApiProperty({
    type: () => FileType,
  })
  file: FileType;
}
