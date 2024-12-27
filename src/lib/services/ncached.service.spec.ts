import { TestBed } from '@angular/core/testing';

import { NcachedService } from './ncached.service';

describe('NcachedService', () => {
  let service: NcachedService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NcachedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('[get / set method] should set a value and return a key from an existing map', () => {
    service.set('value', 'parent', 'child');
    expect(service.get('parent', 'child')).toEqual('value');
  });

  it('[get method] should throw an error if less than two keys are provided', () => {
    expect(() => service.get('key')).toThrowError();
  });

  it('[get method] should throw an error if the lookup key is not found into the Map', () => {
    expect(() => service.get('key1', 'key2')).toThrowError();
  });
});
