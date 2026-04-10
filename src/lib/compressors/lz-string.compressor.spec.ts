import { LzStringCompressor } from './lz-string.compressor';

describe('LzStringCompressor', () => {
  let compressor: LzStringCompressor;

  beforeEach(() => {
    compressor = new LzStringCompressor();
  });

  it('should round-trip compress and decompress a string', () => {
    const input = '{"key":"value","nested":{"a":1,"b":2}}';
    const compressed = compressor.compress(input);
    expect(compressor.decompress(compressed)).toEqual(input);
  });

  it('should produce a compressed output different from the input for non-trivial data', () => {
    const input = 'a'.repeat(1000);
    const compressed = compressor.compress(input);
    expect(compressed).not.toEqual(input);
    expect(compressed.length).toBeLessThan(input.length);
  });

  it('should handle empty strings', () => {
    expect(compressor.decompress(compressor.compress(''))).toEqual('');
  });
});
