import { ICompressor } from '../interfaces/compressor.interface';

/**
 * A no-op compressor that returns the input unchanged.
 * This is the default compressor when no compression is configured.
 */
export class NoopCompressor implements ICompressor {
  /**
   * Returns the input string unchanged.
   *
   * @param data - The string to "compress"
   * @returns The same string
   */
  public compress(data: string): string {
    return data;
  }

  /**
   * Returns the input string unchanged.
   *
   * @param data - The string to "decompress"
   * @returns The same string
   */
  public decompress(data: string): string {
    return data;
  }
}
