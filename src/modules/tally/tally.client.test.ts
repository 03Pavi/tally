import { TallyClient, TallyApiError } from './tally.client.js';

describe('TallyClient', () => {
  const mockApiKey = 'tally_test_secret_key_12345';
  const baseUrl = 'https://api.tally.so';

  describe('Initialization and Configuration', () => {
    it('initializes with provided API key and base URL', () => {
      const client = new TallyClient({ apiKey: mockApiKey, baseUrl });
      expect(client).toBeDefined();
    });

    it('throws when API key is empty', () => {
      expect(() => new TallyClient({ apiKey: '   ', baseUrl })).toThrow('Tally API key cannot be empty');
    });

    it('throws when base URL is not HTTPS', () => {
      expect(() => new TallyClient({ apiKey: mockApiKey, baseUrl: 'http://api.tally.so' })).toThrow(
        'Tally API base URL must use HTTPS'
      );
    });

    it('throws when endpoint path does not start with /', async () => {
      const client = new TallyClient({ apiKey: mockApiKey, baseUrl });
      await expect(client.get('forms')).rejects.toThrow("Invalid endpoint path: forms. Must start with '/'");
    });
  });

  describe('Outbound Requests & Authentication', () => {
    it('sends correct Bearer authorization and custom headers', async () => {
      let interceptedUrl = '';
      let interceptedHeaders: Record<string, string> = {};

      const mockFetch: typeof fetch = jest.fn(async (input, init) => {
        interceptedUrl = String(input);
        const headers = init?.headers as Record<string, string>;
        interceptedHeaders = headers;
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new TallyClient({
        apiKey: mockApiKey,
        baseUrl,
        fetchFn: mockFetch,
        maxRetries: 0,
      });

      const result = await client.get<{ success: boolean }>('/forms', {
        params: { page: 2, limit: 20, workspaceIds: ['ws1', 'ws2'] },
      });

      expect(result).toEqual({ success: true });
      expect(interceptedUrl).toBe('https://api.tally.so/forms?page=2&limit=20&workspaceIds=ws1&workspaceIds=ws2');
      expect(interceptedHeaders['Authorization']).toBe(`Bearer ${mockApiKey}`);
      expect(interceptedHeaders['Accept']).toBe('application/json');
    });
  });

  describe('Error Handling and Status Code Mapping', () => {
    it('handles 400 Bad Request and maps to 400', async () => {
      const mockFetch: typeof fetch = jest.fn(async () => {
        return new Response(JSON.stringify({ error: 'Invalid parameters provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new TallyClient({
        apiKey: mockApiKey,
        baseUrl,
        fetchFn: mockFetch,
        maxRetries: 0,
      });

      try {
        await client.get('/forms');
        fail('Should have thrown TallyApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(TallyApiError);
        const error = err as TallyApiError;
        expect(error.status).toBe(400);
        expect(error.mappedStatus).toBe(400);
        expect(error.message).toBe('Invalid parameters provided');
        expect(error.isRetryable).toBe(false);
      }
    });

    it('maps Tally 401 Unauthorized to 502 to avoid misleading internal callers and does not leak API key', async () => {
      const mockFetch: typeof fetch = jest.fn(async () => {
        return new Response(JSON.stringify({ message: `Invalid token: ${mockApiKey}` }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new TallyClient({
        apiKey: mockApiKey,
        baseUrl,
        fetchFn: mockFetch,
        maxRetries: 0,
      });

      try {
        await client.get('/forms');
        fail('Should have thrown TallyApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(TallyApiError);
        const error = err as TallyApiError;
        expect(error.status).toBe(401);
        expect(error.mappedStatus).toBe(502);
        expect(error.message).toContain('Tally API authentication failed');
        // Ensure secret was sanitized
        expect(error.message).not.toContain(mockApiKey);
      }
    });

    it('maps 403 Forbidden to 403', async () => {
      const mockFetch: typeof fetch = jest.fn(async () => {
        return new Response(JSON.stringify({ message: 'Forbidden access' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new TallyClient({
        apiKey: mockApiKey,
        baseUrl,
        fetchFn: mockFetch,
        maxRetries: 0,
      });

      try {
        await client.get('/forms/123');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TallyApiError);
        const error = err as TallyApiError;
        expect(error.status).toBe(403);
        expect(error.mappedStatus).toBe(403);
      }
    });

    it('maps 404 Not Found to 404', async () => {
      const mockFetch: typeof fetch = jest.fn(async () => {
        return new Response(JSON.stringify({ message: 'Form not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new TallyClient({
        apiKey: mockApiKey,
        baseUrl,
        fetchFn: mockFetch,
        maxRetries: 0,
      });

      try {
        await client.get('/forms/non-existent');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TallyApiError);
        const error = err as TallyApiError;
        expect(error.status).toBe(404);
        expect(error.mappedStatus).toBe(404);
        expect(error.message).toBe('Form not found');
      }
    });

    it('handles 429 Rate Limit with Retry-After header and retries boundedly', async () => {
      let callCount = 0;
      const mockFetch: typeof fetch = jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: 'Too many requests' }), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '1',
            },
          });
        }
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new TallyClient({
        apiKey: mockApiKey,
        baseUrl,
        fetchFn: mockFetch,
        maxRetries: 1,
      });

      const result = await client.get<{ items: unknown[] }>('/forms');
      expect(result).toEqual({ items: [] });
      expect(callCount).toBe(2);
    });

    it('maps 500 upstream server error to 502 Bad Gateway and retries', async () => {
      let callCount = 0;
      const mockFetch: typeof fetch = jest.fn(async () => {
        callCount++;
        return new Response('Internal Server Error', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        });
      });

      const client = new TallyClient({
        apiKey: mockApiKey,
        baseUrl,
        fetchFn: mockFetch,
        maxRetries: 1,
      });

      try {
        await client.get('/forms');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TallyApiError);
        const error = err as TallyApiError;
        expect(error.status).toBe(500);
        expect(error.mappedStatus).toBe(502);
        expect(callCount).toBe(2);
      }
    });

    it('handles network failure and retries up to maxRetries', async () => {
      let callCount = 0;
      const mockFetch: typeof fetch = jest.fn(async () => {
        callCount++;
        throw new Error('ECONNRESET connection reset by peer');
      });

      const client = new TallyClient({
        apiKey: mockApiKey,
        baseUrl,
        fetchFn: mockFetch,
        maxRetries: 1,
      });

      try {
        await client.get('/forms');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TallyApiError);
        const error = err as TallyApiError;
        expect(error.status).toBe(502);
        expect(callCount).toBe(2);
      }
    });
  });
});
