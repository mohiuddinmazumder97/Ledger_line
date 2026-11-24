import nextVitals from 'eslint-config-next/core-web-vitals';
import { base } from './base.js';

/** @param {{ tsconfigRootDir: string, ignores?: string[] }} opts */
export function next(opts) {
  return [...nextVitals, ...base({ ...opts, ignores: ['next-env.d.ts', ...(opts.ignores ?? [])] })];
}
