import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AllConfigType } from '../../../config/config.type.js';
import { FileDriver } from '../../config/file-config.type.js';

@Injectable()
export class FileUrlService {
  private s3: S3Client | null = null;

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  /**
   * 把库存的 path 变成响应里的可访问地址。
   * @param storedPath
   */
  async toPublicPath(storedPath: string): Promise<string> {
    const driver = this.configService.getOrThrow('file.driver', {
      infer: true,
    });
    if (driver === FileDriver.LOCAL) {
      return `${this.configService.getOrThrow('app.backendDomain', { infer: true })}${storedPath}`;
    }
    if (driver === FileDriver.S3 || driver === FileDriver.S3_PRESIGNED) {
      return getSignedUrl(this.client(), this.objectCommand(storedPath), {
        expiresIn: 3600,
      });
    }
    return storedPath;
  }

  /**
   * @param storedPath
   */
  private objectCommand(storedPath: string): GetObjectCommand {
    return new GetObjectCommand({
      Bucket: this.configService.getOrThrow('file.awsDefaultS3Bucket', {
        infer: true,
      }),
      Key: storedPath,
    });
  }

  /**
   * 只在需要签名时创建客户端。
   */
  private client(): S3Client {
    if (this.s3) {
      return this.s3;
    }
    this.s3 = new S3Client({
      region: this.configService.get('file.awsS3Region', { infer: true }),
      credentials: {
        accessKeyId: this.configService.getOrThrow('file.accessKeyId', {
          infer: true,
        }),
        secretAccessKey: this.configService.getOrThrow('file.secretAccessKey', {
          infer: true,
        }),
      },
    });
    return this.s3;
  }
}
