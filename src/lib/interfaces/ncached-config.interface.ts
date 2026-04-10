import { ICompressor } from './compressor.interface';

/**
 * Configuration for the ncached library.
 * Provided via the NCACHED_CONFIG injection token.
 */
export interface INcachedConfig {
  /** Optional persistence configuration. Disabled by default. */
  persistence?: {
    /** Enable localStorage persistence. */
    enabled: boolean;
    /** localStorage key for the cache snapshot. Defaults to 'ncached_snapshot'. */
    storageKey?: string;
    /** Compression strategy. Defaults to NoopCompressor. */
    compressor?: ICompressor;
  };
}
