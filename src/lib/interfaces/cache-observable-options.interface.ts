/**
 * Configuration for the cacheObservable() method.
 *
 * @template T The type of the Observable value
 */
export interface ICacheObservableOptions<T = unknown> {
  /** Time-to-live in milliseconds for the cached result. Omit for no expiration. */
  ttl?: number;
  /** Fallback value returned if the source errors and no cached value exists. */
  defaultValue?: T;
}
