import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Non-pooled URL for Prisma Migrate (e.g. Neon without `-pooler`). Optional; CLI-only. */
  DIRECT_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  WEB_ORIGIN: z.url(),
  PORT: z.coerce.number().int().positive().default(4000),
  SEED_TODAY: z.iso.date().default('2026-11-22'),
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
