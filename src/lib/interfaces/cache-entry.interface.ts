/**
 * Wraps a cached value with expiration metadata.
 *
 * @template T The type of the cached value
 */
export interface ICacheEntry<T> {
  /** The cached value. */
  value: T;
  /** Epoch timestamp (ms) when this entry expires, or null for no expiration. */
  expiresAt: number | null;
}
