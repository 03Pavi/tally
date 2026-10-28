import { TallyClient } from './tally.client.js';
import type {
  ListFormsQuery,
  ListFormsResponse,
  FormDetails,
  GetQuestionsResponse,
  ListSubmissionsQuery,
  ListSubmissionsResponse,
  GetSubmissionResponse,
  TallyUser,
  GetCurrentUserQuery,
} from './tally.types.js';

export class TallyService {
  private readonly client: TallyClient;

  constructor(client?: TallyClient) {
    this.client = client ?? new TallyClient();
  }

  /**
   * Retrieves a paginated list of forms.
   * Documented endpoint: GET https://api.tally.so/forms
   */
  public async listForms(query: ListFormsQuery = {}): Promise<ListFormsResponse> {
    const params: Record<string, string | number | string[] | undefined> = {};
    if (query.page !== undefined) params['page'] = query.page;
    if (query.limit !== undefined) params['limit'] = query.limit;
    if (query.workspaceIds !== undefined && query.workspaceIds.length > 0) {
      params['workspaceIds'] = query.workspaceIds;
    }

    return this.client.get<ListFormsResponse>('/forms', { params });
  }

  /**
   * Retrieves a single form by its ID with all blocks and settings.
   * Documented endpoint: GET https://api.tally.so/forms/{formId}
   */
  public async getForm(formId: string): Promise<FormDetails> {
    if (!formId || !formId.trim()) {
      throw new Error('formId is required');
    }
    return this.client.get<FormDetails>(`/forms/${encodeURIComponent(formId.trim())}`);
  }

  /**
   * Retrieves all questions configured in a form.
   * Documented endpoint: GET https://api.tally.so/forms/{formId}/questions
   */
  public async listQuestions(formId: string): Promise<GetQuestionsResponse> {
    if (!formId || !formId.trim()) {
      throw new Error('formId is required');
    }
    return this.client.get<GetQuestionsResponse>(`/forms/${encodeURIComponent(formId.trim())}/questions`);
  }

  /**
   * Retrieves a paginated list of form submissions with optional filtering.
   * Documented endpoint: GET https://api.tally.so/forms/{formId}/submissions
   */
  public async listSubmissions(
    formId: string,
    query: ListSubmissionsQuery = {}
  ): Promise<ListSubmissionsResponse> {
    if (!formId || !formId.trim()) {
      throw new Error('formId is required');
    }

    const params: Record<string, string | number | undefined> = {};
    if (query.page !== undefined) params['page'] = query.page;
    if (query.limit !== undefined) params['limit'] = query.limit;
    if (query.filter !== undefined) params['filter'] = query.filter;
    if (query.startDate !== undefined) params['startDate'] = query.startDate;
    if (query.endDate !== undefined) params['endDate'] = query.endDate;
    if (query.afterId !== undefined) params['afterId'] = query.afterId;

    return this.client.get<ListSubmissionsResponse>(
      `/forms/${encodeURIComponent(formId.trim())}/submissions`,
      { params }
    );
  }

  /**
   * Retrieves a specific form submission with its responses and questions.
   * Documented endpoint: GET https://api.tally.so/forms/{formId}/submissions/{submissionId}
   */
  public async getSubmission(formId: string, submissionId: string): Promise<GetSubmissionResponse> {
    if (!formId || !formId.trim()) {
      throw new Error('formId is required');
    }
    if (!submissionId || !submissionId.trim()) {
      throw new Error('submissionId is required');
    }

    return this.client.get<GetSubmissionResponse>(
      `/forms/${encodeURIComponent(formId.trim())}/submissions/${encodeURIComponent(submissionId.trim())}`
    );
  }

  /**
   * Retrieves information about the authenticated user.
   * Documented endpoint: GET https://api.tally.so/users/me
   */
  public async getCurrentUser(query: GetCurrentUserQuery = {}): Promise<TallyUser> {
    const params: Record<string, string | undefined> = {};
    if (query.timezone !== undefined) {
      params['timezone'] = query.timezone;
    }
    return this.client.get<TallyUser>('/users/me', { params });
  }
}
