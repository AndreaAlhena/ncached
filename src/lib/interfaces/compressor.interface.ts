/**
 * Compression strategy for the persistence layer.
 * Implementations MUST be synchronous — the persist step runs
 * inside a beforeunload handler which does not support async work.
 */
export interface ICompressor {
  /**
   * Compresses a string for storage.
   *
   * @param data - The string to compress
   * @returns The compressed string
   */
  compress(data: string): string;

  /**
   * Decompresses a previously compressed string.
   *
   * @param data - The compressed string
   * @returns The original string
   */
  decompress(data: string): string;
}
