import type { KeyboardEvent } from 'react';

/** Convert a number/API value to comma-decimal display string: 123.45 → "123,45" */
export const toPriceInput = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '';
  return String(val).replace('.', ',');
};

/** Parse a comma-decimal input string to float: "123,45" → 123.45 */
export const fromPriceInput = (val: string): number =>
  parseFloat(String(val).replace(',', '.')) || 0;

/** KeyDown handler: blocks the period key */
export const blockDot = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === '.') e.preventDefault();
};

/** onChange normalizer: replaces period with comma */
export const normalizePriceInput = (val: string): string =>
  val.replace(/\./g, ',');
