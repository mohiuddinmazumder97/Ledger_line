import { csvField, csvRow } from './csv.js';

describe('csv', () => {
  it('quotes every field and doubles inner quotes', () => {
    expect(csvField('Bistro 42')).toBe('"Bistro 42"');
    expect(csvField('Say "hi", then leave')).toBe('"Say ""hi"", then leave"');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises formula-looking text but not numbers', () => {
    expect(csvField('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvField('@cmd')).toBe('"\'@cmd"');
    expect(csvField('-12.50', { text: false })).toBe('"-12.50"');
  });

  it('joins a row with CRLF', () => {
    expect(csvRow([{ value: 'a' }, { value: 'b,c' }])).toBe('"a","b,c"\r\n');
  });
});
