import { getEnv } from '../config/env.js';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface TallyClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchFn?: typeof fetch;
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean | string[] | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

export class TallyApiError extends Error {
  public readonly status: number;
  public readonly mappedStatus: number;
  public readonly retryAfterSeconds?: number;
  public readonly isRetryable: boolean;
  public readonly upstreamErrorBody?: unknown;

  constructor(params: {
    message: string;
    status: number;
    mappedStatus: number;
    retryAfterSeconds?: number;
    isRetryable?: boolean;
    upstreamErrorBody?: unknown;
  }) {
    super(params.message);
    this.name = 'TallyApiError';
    this.status = params.status;
    this.mappedStatus = params.mappedStatus;
    this.retryAfterSeconds = params.retryAfterSeconds;
    this.isRetryable = params.isRetryable ?? false;
    this.upstreamErrorBody = params.upstreamErrorBody;
    Object.setPrototypeOf(this, TallyApiError.prototype);
  }
}

export class TallyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: TallyClientOptions = {}) {
    if (options.apiKey !== undefined) {
      if (!options.apiKey.trim()) {
        throw new Error('Tally API key cannot be empty');
      }
      this.apiKey = options.apiKey;
    } else {
      const env = getEnv();
      this.apiKey = env.TALLY_API_KEY;
    }

    const env = options.baseUrl && options.timeoutMs && options.maxRetries ? null : getEnvSafe();
    const rawBaseUrl = options.baseUrl ?? env?.TALLY_API_BASE_URL ?? 'https://api.tally.so';

    if (!rawBaseUrl.startsWith('https://')) {
      throw new Error('Tally API base URL must use HTTPS');
    }

    this.baseUrl = rawBaseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? env?.TALLY_REQUEST_TIMEOUT_MS ?? 10000;
    this.maxRetries = options.maxRetries ?? env?.TALLY_MAX_RETRIES ?? 2;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private sanitizeMessage(text: string): string {
    if (!this.apiKey) return text;
    return text.replaceAll(this.apiKey, '[REDACTED_API_KEY]');
  }

  private buildQueryString(params?: Record<string, string | number | boolean | string[] | undefined>): string {
    if (!params) return '';
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null && item !== '') {
            searchParams.append(key, String(item));
          }
        }
      } else {
        searchParams.append(key, String(value));
      }
    }

    const qs = searchParams.toString();
    return qs ? `?${qs}` : '';
  }

  public async get<T>(endpointPath: string, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('GET', endpointPath, options);
  }

  public async post<T>(endpointPath: string, body?: unknown, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('POST', endpointPath, { ...options, body });
  }

  public async patch<T>(endpointPath: string, body?: unknown, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('PATCH', endpointPath, { ...options, body });
  }

  public async delete<T>(endpointPath: string, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('DELETE', endpointPath, options);
  }

  public async request<T>(method: HttpMethod, endpointPath: string, options: RequestOptions = {}): Promise<T> {
    if (!endpointPath.startsWith('/')) {
      throw new Error(`Invalid endpoint path: ${endpointPath}. Must start with '/'`);
    }

    const queryString = this.buildQueryString(options.params);
    const fullUrl = `${this.baseUrl}${endpointPath}${queryString}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'User-Agent': 'TallyExpressService/1.0',
      ...options.headers,
    };

    let serializedBody: string | undefined;
    if (options.body !== undefined && options.body !== null) {
      headers['Content-Type'] = 'application/json';
      serializedBody = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const isSafeMethod = method === 'GET';
    const effectiveMaxRetries = isSafeMethod ? this.maxRetries : 0; // Only retry idempotent GETs by default

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= effectiveMaxRetries) {
      attempt++;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(new Error(`Tally API request timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }

      try {
        const response = await this.fetchFn(fullUrl, {
          method,
          headers,
          body: serializedBody,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          if (response.status === 204) {
            return undefined as unknown as T;
          }

          const responseText = await response.text();
          if (!responseText.trim()) {
            return undefined as unknown as T;
          }

          try {
            return JSON.parse(responseText) as T;
          } catch {
            return responseText as unknown as T;
          }
        }

        const errorBody = await this.safeReadBody(response);
        const retryAfterHeader = response.headers.get('Retry-After');
        let retryAfterSeconds: number | undefined;
        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsed) && parsed > 0) {
            retryAfterSeconds = parsed;
          }
        }

        const is429 = response.status === 429;
        const isServerErr = response.status >= 500 && response.status <= 599;
        const isRetryable = isSafeMethod && (is429 || isServerErr);

        let mappedStatus = 502;
        let errorMessage = `Tally API responded with status ${response.status}`;

        if (response.status === 400) {
          mappedStatus = 400;
          errorMessage = extractErrorMessage(errorBody) || 'Bad request to Tally API';
        } else if (response.status === 401) {
          mappedStatus = 502;
          errorMessage = 'Tally API authentication failed. Please check server credentials.';
        } else if (response.status === 403) {
          mappedStatus = 403;
          errorMessage = extractErrorMessage(errorBody) || 'Access to requested Tally resource is forbidden';
        } else if (response.status === 404) {
          mappedStatus = 404;
          errorMessage = extractErrorMessage(errorBody) || 'Requested Tally resource not found';
        } else if (response.status === 429) {
          mappedStatus = 429;
          errorMessage = 'Tally API rate limit reached (100 requests per minute)';
        } else if (isServerErr) {
          mappedStatus = 502;
          errorMessage = 'Tally API server error';
        }

        const tallyError = new TallyApiError({
          message: this.sanitizeMessage(errorMessage),
          status: response.status,
          mappedStatus,
          retryAfterSeconds,
          isRetryable,
          upstreamErrorBody: errorBody,
        });

        if (isRetryable && attempt <= effectiveMaxRetries) {
          lastError = tallyError;
          const delayMs = this.computeRetryDelay(attempt, retryAfterSeconds);
          await this.sleep(delayMs);
          continue;
        }

        throw tallyError;
      } catch (err) {
        clearTimeout(timeoutId);

        if (err instanceof TallyApiError) {
          throw err;
        }

        const isAbort = (err as Error).name === 'AbortError';
        const isTimeout = isAbort && String((err as Error).message).includes('timed out');

        const networkError = new TallyApiError({
          message: isTimeout
            ? `Tally API request timed out after ${this.timeoutMs}ms`
            : this.sanitizeMessage(`Failed to connect to Tally API: ${(err as Error).message || 'Network error'}`),
          status: isTimeout ? 504 : 502,
          mappedStatus: isTimeout ? 504 : 502,
          isRetryable: isSafeMethod,
        });

        if (isSafeMethod && attempt <= effectiveMaxRetries) {
          lastError = networkError;
          const delayMs = this.computeRetryDelay(attempt);
          await this.sleep(delayMs);
          continue;
        }

        throw networkError;
      }
    }

    throw lastError || new TallyApiError({
      message: 'Tally API request failed after maximum retries',
      status: 502,
      mappedStatus: 502,
    });
  }

  private computeRetryDelay(attempt: number, retryAfterSeconds?: number): number {
    if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
      return Math.min(retryAfterSeconds * 1000, 5000);
    }
    const baseDelay = 200;
    const exponential = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.floor(Math.random() * 100);
    return exponential + jitter;
  }

  private async safeReadBody(response: Response): Promise<unknown> {
    try {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === 'string') return body;
  if (typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
  }
  return null;
}

function getEnvSafe() {
  try {
    return getEnv();
  } catch {
    return null;
  }
}
