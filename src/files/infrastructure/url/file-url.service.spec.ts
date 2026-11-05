import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AllConfigType } from '../../../config/config.type.js';
import { FileDriver } from '../../config/file-config.type.js';
import { FileUrlService } from './file-url.service.js';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(() => Promise.resolve('https://signed.example/file')),
}));

describe('FileUrlService', () => {
  it('should prefix a local path with the backend domain', async () => {
    const service = new FileUrlService(
      config({
        'file.driver': FileDriver.LOCAL,
        'app.backendDomain': 'http://localhost:3000',
      }),
    );

    await expect(service.toPublicPath('/api/v1/files/a.jpg')).resolves.toBe(
      'http://localhost:3000/api/v1/files/a.jpg',
    );
  });

  it('should return a signed url for object storage', async () => {
    const service = new FileUrlService(
      config({
        'file.driver': FileDriver.S3_PRESIGNED,
        'file.awsDefaultS3Bucket': 'bucket',
        'file.awsS3Region': 'us-east-1',
        'file.accessKeyId': 'key',
        'file.secretAccessKey': 'secret',
      }),
    );

    await expect(service.toPublicPath('object-key')).resolves.toBe(
      'https://signed.example/file',
    );
    expect(getSignedUrl).toHaveBeenCalled();
  });
});

/**
 * @param values
 */
function config(values: Record<string, string>): ConfigService<AllConfigType> {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService<AllConfigType>;
}
