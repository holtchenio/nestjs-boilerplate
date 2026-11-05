import { assertImageBytes, isImageHeader } from './image-bytes.js';

describe('image bytes', () => {
  it('should accept jpeg, png, and gif headers', () => {
    expect(isImageHeader(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe(true);
    expect(isImageHeader(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
    expect(isImageHeader(Buffer.from([0x47, 0x49, 0x46, 0x38]))).toBe(true);
  });

  it('should reject a text buffer', () => {
    const bytes = Buffer.from('not an image');
    expect(isImageHeader(bytes)).toBe(false);
    expect(() => assertImageBytes(bytes)).toThrow();
  });
});
