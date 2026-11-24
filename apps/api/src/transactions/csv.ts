/** SPEC §5 columns, in order. */
export const CSV_HEADER = [
  'Date',
  'Time',
  'Type',
  'Amount',
  'Currency',
  'Account',
  'To account',
  'Category',
  'Sub-category',
  'Note',
  'Tags',
] as const;

/**
 * One CSV field: always quoted (as in the prototype), inner quotes doubled.
 * Free-text fields starting with = + - @ or a control char get a leading apostrophe so
 * spreadsheet apps don't evaluate them as formulas (CSV injection).
 */
export function csvField(value: string, { text = true } = {}): string {
  const safe = text && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvRow(fields: ReadonlyArray<{ value: string; text?: boolean }>): string {
  return fields.map((f) => csvField(f.value, { text: f.text ?? true })).join(',') + '\r\n';
}
