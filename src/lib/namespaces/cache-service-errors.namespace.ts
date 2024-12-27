export namespace CacheServiceErrors {
    export class KeyNotFound extends Error {
      constructor(key: string) {
        super(`The key ${key} doesn't exist in the cache object`);
      }
    }
  
    export class InsufficientsKeysProvidedError extends Error {
      constructor() {
        super('Not enough keys provided: you shall provide at least a module and a map key');
      }
    }
  
    export class MapNotFound extends Error {
      constructor(key: string) {
        super(`A map has not been found in the cache object for the given ${key} key`);
      }
    }
  
    export class ValueNotFound extends Error {
      constructor(key: string) {
        super(`A value has not been found in the Map for the given ${key} key`);
      }
    }
  }
  