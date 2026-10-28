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
  TALLY_API_KEY: z.string().min(1, 'TALLY_API_KEY is required'),
  TALLY_API_BASE_URL: z
    .string()
    .url()
    .default('https://api.tally.so')
    .refine((url) => url.startsWith('https://'), {
      message: 'TALLY_API_BASE_URL must use HTTPS protocol',
    }),
  TALLY_REQUEST_TIMEOUT_MS: z
    .string()
    .default('10000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  TALLY_MAX_RETRIES: z
    .string()
    .default('2')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(0).max(5)),
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
