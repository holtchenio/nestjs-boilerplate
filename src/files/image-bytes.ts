import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const GIF = [0x47, 0x49, 0x46, 0x38];

/**
 * @param bytes
 * @param signature
 */
function startsWith(bytes: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * @param bytes
 */
export function isImageHeader(bytes: Buffer): boolean {
  return (
    startsWith(bytes, JPEG) || startsWith(bytes, PNG) || startsWith(bytes, GIF)
  );
}

/**
 * 扩展名不能代替文件头。不匹配时按现有上传错误码拒绝。
 * @param bytes
 */
export function assertImageBytes(bytes: Buffer): void {
  if (isImageHeader(bytes)) {
    return;
  }
  throw new UnprocessableEntityException({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    errors: {
      file: 'cantUploadFileType',
    },
  });
}

/**
 * @param fileName
 */
export function contentTypeForName(fileName: string): string | null {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') {
    return 'image/jpeg';
  }
  if (extension === 'png') {
    return 'image/png';
  }
  if (extension === 'gif') {
    return 'image/gif';
  }
  return null;
}
