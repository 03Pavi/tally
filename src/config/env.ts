import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  TALLY_PRIME_URL: z
    .string()
    .url()
    .default('http://localhost:9000'),
  TALLY_PRIME_COMPANY: z
    .string()
    .optional(),
  TALLY_PRIME_TIMEOUT_MS: z
    .string()
    .default('15000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnv(envInput: Record<string, string | undefined> = process.env): EnvConfig {
  const result = envSchema.safeParse(envInput);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Invalid environment configuration: ${errorDetails}`);
  }
  return result.data;
}

// Lazy getter for environment to prevent early exit during unit tests if env isn't loaded yet
let cachedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = loadEnv();
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
