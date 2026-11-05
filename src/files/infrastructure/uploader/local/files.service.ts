import { readFile, unlink } from 'node:fs/promises';
import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FileRepository } from '../../persistence/file.repository.js';
import { AllConfigType } from '../../../../config/config.type.js';
import { FileType } from '../../../domain/file.js';
import { assertImageBytes } from '../../../image-bytes.js';
import { FileUrlService } from '../../url/file-url.service.js';

@Injectable()
export class FilesLocalService {
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly fileRepository: FileRepository,
    private readonly fileUrls: FileUrlService,
  ) {}

  async create(file: Express.Multer.File): Promise<{ file: FileType }> {
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          file: 'selectFile',
        },
      });
    }

    const bytes = await readFile(file.path);
    try {
      assertImageBytes(bytes);
    } catch (error) {
      await unlink(file.path);
      throw error;
    }

    const created = await this.fileRepository.create({
      path: `/${this.configService.get('app.apiPrefix', {
        infer: true,
      })}/v1/${file.path}`,
    });
    created.path = await this.fileUrls.toPublicPath(created.path);
    return { file: created };
  }
}
