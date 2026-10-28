import { TallyService } from './tally.service.js';
import { TallyClient } from './tally.client.js';
import type {
  ListFormsResponse,
  FormDetails,
  GetQuestionsResponse,
  ListSubmissionsResponse,
  GetSubmissionResponse,
  TallyUser,
} from './tally.types.js';

describe('TallyService', () => {
  let mockClient: jest.Mocked<TallyClient>;
  let service: TallyService;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
    } as unknown as jest.Mocked<TallyClient>;

    service = new TallyService(mockClient);
  });

  describe('listForms', () => {
    it('requests /forms with correct pagination and filter params', async () => {
      const mockResponse: ListFormsResponse = {
        items: [
          {
            id: 'form_123',
            name: 'Customer Feedback',
            workspaceId: 'ws_abc',
            status: 'PUBLISHED',
            numberOfSubmissions: 5,
            isClosed: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        page: 1,
        limit: 50,
        total: 1,
        hasMore: false,
      };

      mockClient.get.mockResolvedValueOnce(mockResponse);

      const result = await service.listForms({ page: 1, limit: 50, workspaceIds: ['ws_abc'] });

      expect(mockClient.get).toHaveBeenCalledWith('/forms', {
        params: { page: 1, limit: 50, workspaceIds: ['ws_abc'] },
      });
      expect(result).toEqual(mockResponse);
    });

    it('handles listForms without query parameters', async () => {
      mockClient.get.mockResolvedValueOnce({ items: [], page: 1, limit: 50, total: 0, hasMore: false });
      await service.listForms();
      expect(mockClient.get).toHaveBeenCalledWith('/forms', { params: {} });
    });
  });

  describe('getForm', () => {
    it('requests /forms/{formId} with URL encoding', async () => {
      const mockForm: FormDetails = {
        id: 'form_xyz',
        name: 'Contact Form',
        workspaceId: 'ws_1',
        status: 'PUBLISHED',
        numberOfSubmissions: 10,
        isClosed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        settings: {
          language: 'en',
          isClosed: false,
        },
        blocks: [],
      };

      mockClient.get.mockResolvedValueOnce(mockForm);

      const result = await service.getForm('form_xyz');
      expect(mockClient.get).toHaveBeenCalledWith('/forms/form_xyz');
      expect(result).toEqual(mockForm);
    });

    it('throws error when formId is empty', async () => {
      await expect(service.getForm('  ')).rejects.toThrow('formId is required');
    });
  });

  describe('listQuestions', () => {
    it('requests /forms/{formId}/questions', async () => {
      const mockQuestions: GetQuestionsResponse = {
        questions: [
          {
            id: 'q_1',
            type: 'INPUT_TEXT',
            title: 'Your Name',
            formId: 'form_xyz',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        hasResponses: true,
      };

      mockClient.get.mockResolvedValueOnce(mockQuestions);

      const result = await service.listQuestions('form_xyz');
      expect(mockClient.get).toHaveBeenCalledWith('/forms/form_xyz/questions');
      expect(result).toEqual(mockQuestions);
    });

    it('throws error when formId is empty', async () => {
      await expect(service.listQuestions('')).rejects.toThrow('formId is required');
    });
  });

  describe('listSubmissions', () => {
    it('requests /forms/{formId}/submissions with supported query filters', async () => {
      const mockSubmissions: ListSubmissionsResponse = {
        page: 1,
        limit: 25,
        hasMore: false,
        totalNumberOfSubmissionsPerFilter: { all: 1, completed: 1, partial: 0 },
        questions: [],
        submissions: [
          {
            id: 'sub_1',
            formId: 'form_xyz',
            isCompleted: true,
            submittedAt: '2026-01-01T12:00:00.000Z',
            responses: [],
          },
        ],
      };

      mockClient.get.mockResolvedValueOnce(mockSubmissions);

      const result = await service.listSubmissions('form_xyz', {
        page: 1,
        limit: 25,
        filter: 'completed',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      expect(mockClient.get).toHaveBeenCalledWith('/forms/form_xyz/submissions', {
        params: {
          page: 1,
          limit: 25,
          filter: 'completed',
          startDate: '2026-01-01T00:00:00.000Z',
        },
      });
      expect(result).toEqual(mockSubmissions);
    });

    it('throws error when formId is empty', async () => {
      await expect(service.listSubmissions('')).rejects.toThrow('formId is required');
    });
  });

  describe('getSubmission', () => {
    it('requests /forms/{formId}/submissions/{submissionId}', async () => {
      const mockSubmission: GetSubmissionResponse = {
        questions: [],
        submission: {
          id: 'sub_999',
          formId: 'form_xyz',
          isCompleted: true,
          submittedAt: '2026-01-01T12:00:00.000Z',
          responses: [],
        },
      };

      mockClient.get.mockResolvedValueOnce(mockSubmission);

      const result = await service.getSubmission('form_xyz', 'sub_999');
      expect(mockClient.get).toHaveBeenCalledWith('/forms/form_xyz/submissions/sub_999');
      expect(result).toEqual(mockSubmission);
    });

    it('throws error when formId or submissionId is empty', async () => {
      await expect(service.getSubmission('', 'sub_1')).rejects.toThrow('formId is required');
      await expect(service.getSubmission('form_1', '')).rejects.toThrow('submissionId is required');
    });
  });

  describe('getCurrentUser', () => {
    it('requests /users/me with optional timezone', async () => {
      const mockUser: TallyUser = {
        id: 'usr_1',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        organizationId: 'org_1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        subscriptionPlan: 'PRO',
      };

      mockClient.get.mockResolvedValueOnce(mockUser);

      const result = await service.getCurrentUser({ timezone: 'Europe/Brussels' });
      expect(mockClient.get).toHaveBeenCalledWith('/users/me', {
        params: { timezone: 'Europe/Brussels' },
      });
      expect(result).toEqual(mockUser);
    });
  });
});
