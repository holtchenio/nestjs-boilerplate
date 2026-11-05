import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util.js';
import { FileRepository } from '../../persistence/file.repository.js';
import { FileType } from '../../../domain/file.js';
import { AllConfigType } from '../../../../config/config.type.js';
import { assertImageBytes, contentTypeForName } from '../../../image-bytes.js';
import { FileUrlService } from '../../url/file-url.service.js';

@Injectable()
export class FilesS3Service {
  private s3: S3Client;

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly fileUrls: FileUrlService,
  ) {
    this.s3 = new S3Client({
      region: configService.get('file.awsS3Region', { infer: true }),
      credentials: {
        accessKeyId: configService.getOrThrow('file.accessKeyId', {
          infer: true,
        }),
        secretAccessKey: configService.getOrThrow('file.secretAccessKey', {
          infer: true,
        }),
      },
    });
  }

  /**
   * 先看文件头，再上传。扩展名只是前面的快速拒绝。
   * @param file
   */
  async create(file: Express.Multer.File): Promise<{ file: FileType }> {
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          file: 'selectFile',
        },
      });
    }

    assertImageBytes(file.buffer);
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    const key = `${randomStringGenerator()}.${extension}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.configService.getOrThrow('file.awsDefaultS3Bucket', {
          infer: true,
        }),
        Key: key,
        Body: file.buffer,
        ContentType: contentTypeForName(file.originalname) ?? undefined,
        ContentLength: file.size,
      }),
    );
    const created = await this.fileRepository.create({ path: key });
    created.path = await this.fileUrls.toPublicPath(created.path);
    return { file: created };
  }
}
