/**
 * Namespace containing all custom error classes thrown by NcachedService.
 * Each error class targets a specific failure point in the cache lookup chain.
 */
export namespace NcachedServiceErrors {
    /**
     * Thrown when fewer than two keys are provided to a cache operation.
     * At least a namespace key and a map entry key are required.
     *
     * @example
     * ```typescript
     * service.get('onlyOneKey'); // throws InsufficientsKeysProvidedError
     * ```
     */
    export class InsufficientsKeysProvidedError extends Error {
      constructor() {
        super('Not enough keys provided: you shall provide at least a module and a map key');
      }
    }

    /**
     * Thrown when a navigation key does not exist in the ICacheObject hierarchy.
     *
     * @example
     * ```typescript
     * service.get('nonExistentModule', 'key'); // throws KeyNotFound('nonExistentModule')
     * ```
     */
    export class KeyNotFound extends Error {
      /**
       * @param key - The key that was not found in the cache object
       */
      constructor(key: string) {
        super(`The key ${key} doesn't exist in the cache object`);
      }
    }

    /**
     * Thrown when a navigation key points to an ICacheObject instead of a Map.
     * This happens when the hierarchy depth doesn't match the expected structure.
     *
     * @example
     * ```typescript
     * // If 'module' contains nested objects instead of a Map:
     * service.get('module', 'key'); // throws MapNotFound('module')
     * ```
     */
    export class MapNotFound extends Error {
      /**
       * @param key - The key where a Map was expected but not found
       */
      constructor(key: string) {
        super(`A map has not been found in the cache object for the given ${key} key`);
      }
    }

    /**
     * Thrown when the final lookup key is not present in the target Map,
     * or when the entry exists but has expired (TTL exceeded).
     *
     * @example
     * ```typescript
     * service.set('val', 'mod', 'existingKey');
     * service.get('mod', 'missingKey'); // throws ValueNotFound('missingKey')
     * ```
     */
    export class ValueNotFound extends Error {
      /**
       * @param key - The map entry key that was not found or has expired
       */
      constructor(key: string) {
        super(`A value has not been found in the Map for the given ${key} key`);
      }
    }
  }
