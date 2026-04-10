/**
 * Optional configuration for cache set operations.
 */
export interface ISetOptions {
  /** Time-to-live in milliseconds. If omitted, the entry never expires. */
  ttl?: number;
}
