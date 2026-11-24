import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Non-pooled URL for Prisma Migrate (e.g. Neon without `-pooler`). Optional; CLI-only. */
  DIRECT_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  WEB_ORIGIN: z.url(),
  PORT: z.coerce.number().int().positive().default(4000),
  SEED_TODAY: z.iso.date().default('2026-11-22'),
  /**
   * Express `trust proxy`: which hops may set X-Forwarded-For (client IP for throttling and sessions).
   * "loopback" fits the Next.js rewrite on the same host; "false" disables; a number = hop count;
   * otherwise a comma-separated list of addresses / subnets.
   */
  TRUST_PROXY: z.string().default('loopback'),
  /** Requests per minute per IP on login and register. */
  AUTH_THROTTLE_LIMIT: z.coerce.number().int().positive().default(5),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule: fails fast at boot with a readable list of bad variables. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/** Converts TRUST_PROXY into the value Express expects for `trust proxy`. */
export function parseTrustProxy(value: string): boolean | number | string {
  const v = value.trim();
  if (v === 'true') return true;
  if (v === 'false' || v === '') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}
