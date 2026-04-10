import { NoopCompressor } from './noop.compressor';

describe('NoopCompressor', () => {
  let compressor: NoopCompressor;

  beforeEach(() => {
    compressor = new NoopCompressor();
  });

  it('should return input unchanged on compress', () => {
    expect(compressor.compress('hello world')).toEqual('hello world');
  });

  it('should return input unchanged on decompress', () => {
    expect(compressor.decompress('hello world')).toEqual('hello world');
  });

  it('should handle empty strings', () => {
    expect(compressor.compress('')).toEqual('');
    expect(compressor.decompress('')).toEqual('');
  });
});
