<p align="center">
   <img src="https://iili.io/2StGF3l.th.png" alt="ncached logo">
</p>

# Ncached

Just a simple Angular multi layer cache service

Ncached has been thought as a multi layer cache for Angular applications. It's purpose is simple: allowing developers to create a layered (or multi-level) cache in a breeze.

## Installation

Use npm (or yarn if you prefer)

```bash
npm install ncached
```

## Usage

```typescript
import { NcachedService } from 'ncached';
```

### Inject the service in a proper injection context
```typescript
class AppComponent {
  private _ncachedService: NcachedService = inject(NcachedService);
}
```

### Set a value
This will create a Map into an object like this: {key1: new Map()}. The 'value' will be placed into the 'key2' key of the Map instance
```typescript
this._ncachedService.set('value', 'key1', 'key2');
```

### Set a value in a deeper level
This will create a Map into an object like this: {root: {parent: new Map()}}. The 'value' will be placed into the 'child' key of the Map instance
```typescript
this._ncachedService.set('value', 'root', 'parent', 'child');
```

### Get a value
Once you have properly set a value, you can use the get method to read from the cache. Accordingly to the two previous examples:
```typescript
this._ncachedService.get('key1', 'key2');
this._ncachedService.get('root', 'parent', 'child');
```

## Errors
Both the get and the set methods shall throw errors if something is going wrong, so you may be interested in wrapping these methods into a try / catch statement. Errors are declared into the CacheServiceErrors namespace.

### &nbsp;&nbsp;&nbsp;&nbsp;Get method
* InsufficientsKeysProvidedError - Less than 2 keywords have been provided
* ValueNotFound - The last key provided has not been found into the Map instance, so no value has been found for the lookup key

## Running tests
```bash
npm run test
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)