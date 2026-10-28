/**
 * TypeScript types for Tally API requests and responses based on official Tally documentation:
 * https://developers.tally.so/llms.txt
 */

export type FormStatus = 'BLANK' | 'DRAFT' | 'PUBLISHED';

export interface FormPayment {
  amount?: number;
  currency?: string;
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

export type BlockType =
  | 'FORM_TITLE'
  | 'TEXT'
  | 'LABEL'
  | 'TITLE'
  | 'HEADING_1'
  | 'HEADING_2'
  | 'HEADING_3'
  | 'DIVIDER'
  | 'PAGE_BREAK'
  | 'IMAGE'
  | 'EMBED'
  | 'EMBED_VIDEO'
  | 'EMBED_AUDIO'
  | 'QUESTION'
  | 'MATRIX'
  | 'INPUT_TEXT'
  | 'INPUT_NUMBER'
  | 'INPUT_EMAIL'
  | 'INPUT_LINK'
  | 'INPUT_PHONE_NUMBER'
  | 'INPUT_DATE'
  | 'INPUT_TIME'
  | 'TEXTAREA'
  | 'FILE_UPLOAD'
  | 'LINEAR_SCALE'
  | 'RATING'
  | 'HIDDEN_FIELDS'
  | 'MULTIPLE_CHOICE_OPTION'
  | 'CHECKBOX'
  | 'DROPDOWN_OPTION'
  | 'RANKING_OPTION'
  | 'MULTI_SELECT_OPTION'
  | 'PAYMENT'
  | 'SIGNATURE'
  | 'MATRIX_ROW'
  | 'MATRIX_COLUMN'
  | 'CONDITIONAL_LOGIC'
  | 'CALCULATED_FIELDS'
  | 'CAPTCHA'
  | 'RESPONDENT_COUNTRY'
  | string;

export interface Block {
  uuid: string;
  type: BlockType;
  groupUuid?: string;
  groupType?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FormDetails extends Form {
  settings?: FormSettings;
  blocks?: Block[];
}

export interface QuestionField {
  uuid: string;
  type: BlockType;
  blockGroupUuid?: string;
  title?: string;
}

export interface Question {
  id: string;
  type: BlockType;
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

export interface SubmissionsPerFilterCount {
  all?: number;
  completed?: number;
  partial?: number;
}

export interface ListSubmissionsResponse {
  page: number;
  limit: number;
  hasMore: boolean;
  totalNumberOfSubmissionsPerFilter?: SubmissionsPerFilterCount;
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

export interface TallyUser {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string;
  avatarUrl?: string | null;
  organizationId: string;
  isDeleted?: boolean;
  hasTwoFactorEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  subscriptionPlan: 'FREE' | 'PRO' | 'BUSINESS' | string;
}

export interface GetCurrentUserQuery {
  timezone?: string;
}
