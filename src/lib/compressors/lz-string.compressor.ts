import * as LZString from 'lz-string';
import { ICompressor } from '../interfaces/compressor.interface';

/**
 * Compressor using lz-string's UTF-16 encoding, optimized for localStorage.
 * All operations are synchronous (safe for beforeunload handlers).
 */
export class LzStringCompressor implements ICompressor {
  /**
   * Compresses a string using lz-string's compressToUTF16.
   *
   * @param data - The string to compress
   * @returns The compressed UTF-16 string
   */
  public compress(data: string): string {
    return LZString.compressToUTF16(data);
  }

  /**
   * Decompresses a UTF-16 compressed string.
   *
   * @param data - The compressed string
   * @returns The original string
   */
  public decompress(data: string): string {
    return LZString.decompressFromUTF16(data) ?? '';
  }
}
