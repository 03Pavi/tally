export type FormStatus = 'BLANK' | 'DRAFT' | 'PUBLISHED';

export interface FormPayment {
  amount?: number;
  currency?: string;
}

export interface FormSettings {
  language?: string | null;
  isClosed?: boolean;
  closeMessageTitle?: string | null;
  closeMessageDescription?: string | null;
  closeTimezone?: string | null;
  closeDate?: string | null;
  closeTime?: string | null;
  submissionsLimit?: number | null;
  hasSelfEmailNotifications?: boolean;
  hasRespondentEmailNotifications?: boolean;
  hasProgressBar?: boolean;
  hasPartialSubmissions?: boolean;
  pageAutoJump?: boolean;
  saveForLater?: boolean;
  styles?: string | null;
  password?: string | null;
  submissionsDataRetentionDuration?: number | null;
  submissionsDataRetentionUnit?: string | null;
  [key: string]: unknown;
}

export interface Block {
  uuid: string;
  type: string;
  groupUuid?: string;
  groupType?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Form {
  id: string;
  name: string;
  workspaceId: string;
  status: FormStatus;
  numberOfSubmissions: number;
  isClosed: boolean;
  payments?: FormPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface FormDetails extends Form {
  settings?: FormSettings;
  blocks?: Block[];
}

export interface CreateFormPayload {
  workspaceId?: string;
  templateId?: string;
  folderId?: string;
  status: FormStatus;
  blocks: Block[];
  settings?: FormSettings;
}

export interface UpdateFormPayload {
  name?: string;
  status?: FormStatus;
  blocks?: Block[];
  settings?: FormSettings;
}

export interface QuestionField {
  uuid: string;
  type: string;
  blockGroupUuid?: string;
  title?: string;
}

export interface Question {
  id: string;
  type: string;
  title: string;
  isTitleModifiedByUser?: boolean;
  formId: string;
  isDeleted?: boolean;
  numberOfResponses?: number;
  createdAt: string;
  updatedAt: string;
  fields?: QuestionField[];
}

export interface SubmissionResponse {
  id: string;
  formId: string;
  questionId: string;
  respondentId: string;
  submissionId?: string | null;
  sessionUuid: string;
  answer: unknown;
  formattedAnswer?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  formId: string;
  isCompleted: boolean;
  submittedAt: string;
  locale?: string | null;
  previewUrl?: string;
  pdfUrl?: string;
  responses: SubmissionResponse[];
}

export interface SubmissionDetail extends Submission {
  createdAt?: string;
  updatedAt?: string;
}

export interface ListFormsQuery {
  page?: number;
  limit?: number;
  workspaceIds?: string[];
}

export interface ListFormsResponse {
  items: Form[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface ListSubmissionsQuery {
  page?: number;
  limit?: number;
  filter?: 'all' | 'completed' | 'partial';
  startDate?: string;
  endDate?: string;
  afterId?: string;
}

export interface ListSubmissionsResponse {
  page: number;
  limit: number;
  hasMore: boolean;
  totalNumberOfSubmissionsPerFilter?: {
    all?: number;
    completed?: number;
    partial?: number;
  };
  questions: Question[];
  submissions: Submission[];
}

export interface GetSubmissionResponse {
  questions: Question[];
  submission: SubmissionDetail;
}

export interface GetQuestionsResponse {
  questions: Question[];
  hasResponses: boolean;
}
