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
    it('sends correct Bearer authorization and custom headers on GET', async () => {
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

    it('sends POST request with JSON payload', async () => {
      let interceptedMethod = '';
      let interceptedBody = '';

      const mockFetch: typeof fetch = jest.fn(async (_input, init) => {
        interceptedMethod = init?.method || '';
        interceptedBody = String(init?.body);
        return new Response(JSON.stringify({ id: 'f_1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new TallyClient({
        apiKey: mockApiKey,
        baseUrl,
        fetchFn: mockFetch,
      });

      const result = await client.post<{ id: string }>('/forms', { name: 'New Form' });
      expect(result).toEqual({ id: 'f_1' });
      expect(interceptedMethod).toBe('POST');
      expect(JSON.parse(interceptedBody)).toEqual({ name: 'New Form' });
    });

    it('sends PATCH request with JSON payload', async () => {
      let interceptedMethod = '';

      const mockFetch: typeof fetch = jest.fn(async (_input, init) => {
        interceptedMethod = init?.method || '';
        return new Response(JSON.stringify({ id: 'f_1', name: 'Updated' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new TallyClient({
        apiKey: mockApiKey,
        baseUrl,
        fetchFn: mockFetch,
      });

      const result = await client.patch<{ id: string }>('/forms/f_1', { name: 'Updated' });
      expect(result).toEqual({ id: 'f_1', name: 'Updated' });
      expect(interceptedMethod).toBe('PATCH');
    });

    it('handles 204 No Content response on DELETE', async () => {
      const mockFetch: typeof fetch = jest.fn(async () => {
        return new Response(null, { status: 204 });
      });

      const client = new TallyClient({
        apiKey: mockApiKey,
        baseUrl,
        fetchFn: mockFetch,
      });

      const result = await client.delete<void>('/forms/f_1');
      expect(result).toBeUndefined();
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
      }
    });

    it('maps Tally 401 Unauthorized to 502 and sanitizes token', async () => {
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
  });
});
