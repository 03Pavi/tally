import type { Application, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const swaggerDefinition: swaggerJsdoc.OAS3Definition = {
  openapi: '3.0.3',
  info: {
    title: 'Tally API Integration Service',
    version: '1.0.0',
    description:
      'Production-ready Express.js + TypeScript service integrating with the official Tally API (https://api.tally.so). Provides typed, rate-limited, and sanitized access to Users, Organizations, Forms, Questions, Submissions, Analytics, Workspaces, Folders, and Webhooks.',
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment Server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Service health check endpoint' },
    { name: 'Users', description: 'Authenticated user management' },
    { name: 'Organizations', description: 'Organization members and invitation management' },
    { name: 'Forms', description: 'Form creation, retrieval, updates, and deletion' },
    { name: 'Submissions', description: 'Form submissions retrieval and deletion' },
    { name: 'Analytics', description: 'Form metrics, visits, submissions, dimensions, and drop-off analytics' },
    { name: 'Workspaces', description: 'Workspace CRUD operations' },
    { name: 'Folders', description: 'Workspace folders organization' },
    { name: 'Webhooks', description: 'Webhook management and event delivery retry' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Bearer authentication for service-to-service requests (if enabled)',
      },
    },
    schemas: {
      StandardSuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
        },
        required: ['success', 'data'],
      },
      StandardMessageResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Operation completed successfully' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                enum: [
                  'BAD_REQUEST',
                  'VALIDATION_ERROR',
                  'UNAUTHORIZED',
                  'FORBIDDEN',
                  'NOT_FOUND',
                  'RATE_LIMITED',
                  'UPSTREAM_GATEWAY_ERROR',
                  'UPSTREAM_GATEWAY_TIMEOUT',
                  'INTERNAL_SERVER_ERROR',
                ],
                example: 'BAD_REQUEST',
              },
              message: { type: 'string', example: 'Invalid request parameters' },
              upstreamStatus: { type: 'integer', example: 400 },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string', example: 'page' },
                    message: { type: 'string', example: 'Page must be at least 1' },
                  },
                },
              },
            },
            required: ['code', 'message'],
          },
        },
        required: ['success', 'error'],
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'usr_abc123' },
          firstName: { type: 'string', example: 'Jane' },
          lastName: { type: 'string', example: 'Doe' },
          fullName: { type: 'string', example: 'Jane Doe' },
          email: { type: 'string', format: 'email', example: 'jane.doe@example.com' },
          avatarUrl: { type: 'string', format: 'uri', nullable: true, example: 'https://example.com/avatar.png' },
          organizationId: { type: 'string', example: 'org_xyz789' },
          isDeleted: { type: 'boolean', example: false },
          hasTwoFactorEnabled: { type: 'boolean', example: false },
          subscriptionPlan: { type: 'string', enum: ['FREE', 'PRO', 'BUSINESS'], example: 'PRO' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-01-15T10:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-02-01T12:00:00.000Z' },
        },
        required: ['id', 'email', 'organizationId', 'subscriptionPlan', 'createdAt', 'updatedAt'],
      },
      OrganizationInvite: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'inv_12345' },
          email: { type: 'string', format: 'email', example: 'colleague@example.com' },
          organizationId: { type: 'string', example: 'org_xyz789' },
          workspaceIds: { type: 'array', items: { type: 'string' }, example: ['ws_123'] },
          invitedBy: { type: 'string', example: 'usr_abc123' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-02-01T10:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-02-01T10:00:00.000Z' },
        },
        required: ['id', 'email', 'organizationId', 'createdAt', 'updatedAt'],
      },
      CreateOrganizationInviteRequest: {
        type: 'object',
        properties: {
          workspaceIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of workspace IDs to invite users to',
            example: ['ws_123'],
          },
          emails: {
            type: 'string',
            description: 'Comma or semicolon separated list of email addresses to invite',
            example: 'alice@example.com, bob@example.com',
          },
        },
        required: ['workspaceIds', 'emails'],
      },
      FormStatus: {
        type: 'string',
        enum: ['BLANK', 'DRAFT', 'PUBLISHED'],
        example: 'PUBLISHED',
      },
      FormPayment: {
        type: 'object',
        properties: {
          amount: { type: 'number', example: 25.0 },
          currency: { type: 'string', example: 'USD' },
        },
      },
      FormSettings: {
        type: 'object',
        properties: {
          language: { type: 'string', nullable: true, example: 'en' },
          isClosed: { type: 'boolean', example: false },
          closeMessageTitle: { type: 'string', nullable: true, example: 'Form Closed' },
          closeMessageDescription: { type: 'string', nullable: true, example: 'This form is no longer accepting submissions.' },
          closeTimezone: { type: 'string', nullable: true, example: 'Europe/Brussels' },
          closeDate: { type: 'string', nullable: true, example: '2026-12-31' },
          closeTime: { type: 'string', nullable: true, example: '23:59' },
          submissionsLimit: { type: 'integer', nullable: true, example: 500 },
          hasSelfEmailNotifications: { type: 'boolean', example: false },
          hasRespondentEmailNotifications: { type: 'boolean', example: false },
          hasProgressBar: { type: 'boolean', example: true },
          hasPartialSubmissions: { type: 'boolean', example: false },
          pageAutoJump: { type: 'boolean', example: false },
          saveForLater: { type: 'boolean', example: true },
        },
      },
      Block: {
        type: 'object',
        properties: {
          uuid: { type: 'string', format: 'uuid', example: 'e2a87a20-3e28-40b4-9359-52e468ff8ea7' },
          type: {
            type: 'string',
            example: 'INPUT_TEXT',
            description: 'Block type (e.g., FORM_TITLE, TITLE, INPUT_TEXT, INPUT_EMAIL, etc.)',
          },
          groupUuid: { type: 'string', format: 'uuid', example: 'b5674c2e-4b72-46be-9a3b-b27b87c06c5f' },
          groupType: { type: 'string', example: 'QUESTION' },
          payload: { type: 'object' },
        },
        required: ['uuid', 'type'],
      },
      Form: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'mKAvXQ' },
          name: { type: 'string', example: 'Customer Satisfaction Survey' },
          workspaceId: { type: 'string', example: 'ws_123' },
          status: { $ref: '#/components/schemas/FormStatus' },
          numberOfSubmissions: { type: 'integer', example: 42 },
          isClosed: { type: 'boolean', example: false },
          payments: {
            type: 'array',
            items: { $ref: '#/components/schemas/FormPayment' },
          },
          createdAt: { type: 'string', format: 'date-time', example: '2026-01-15T10:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-02-01T15:30:00.000Z' },
        },
        required: ['id', 'name', 'workspaceId', 'status', 'numberOfSubmissions', 'isClosed', 'createdAt', 'updatedAt'],
      },
      FormDetails: {
        allOf: [
          { $ref: '#/components/schemas/Form' },
          {
            type: 'object',
            properties: {
              settings: { $ref: '#/components/schemas/FormSettings' },
              blocks: {
                type: 'array',
                items: { $ref: '#/components/schemas/Block' },
              },
            },
          },
        ],
      },
      CreateFormRequest: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'Target workspace ID', example: 'ws_123' },
          templateId: { type: 'string', description: 'Template to base form on', example: 'tpl_feedback' },
          folderId: { type: 'string', description: 'Folder ID in workspace', example: 'fld_456' },
          status: { $ref: '#/components/schemas/FormStatus' },
          blocks: {
            type: 'array',
            items: { $ref: '#/components/schemas/Block' },
          },
          settings: { $ref: '#/components/schemas/FormSettings' },
        },
        required: ['status', 'blocks'],
      },
      UpdateFormRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Updated Survey Title' },
          status: { $ref: '#/components/schemas/FormStatus' },
          blocks: {
            type: 'array',
            items: { $ref: '#/components/schemas/Block' },
          },
          settings: { $ref: '#/components/schemas/FormSettings' },
        },
      },
      QuestionField: {
        type: 'object',
        properties: {
          uuid: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
          type: { type: 'string', example: 'INPUT_TEXT' },
          blockGroupUuid: { type: 'string', format: 'uuid', example: 'b5674c2e-4b72-46be-9a3b-b27b87c06c5f' },
          title: { type: 'string', example: 'Full Name' },
        },
        required: ['uuid', 'type'],
      },
      Question: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'q_name' },
          type: { type: 'string', example: 'INPUT_TEXT' },
          title: { type: 'string', example: 'What is your full name?' },
          isTitleModifiedByUser: { type: 'boolean', example: true },
          formId: { type: 'string', example: 'mKAvXQ' },
          isDeleted: { type: 'boolean', example: false },
          numberOfResponses: { type: 'integer', example: 42 },
          createdAt: { type: 'string', format: 'date-time', example: '2026-01-15T10:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-01-15T10:00:00.000Z' },
          fields: {
            type: 'array',
            items: { $ref: '#/components/schemas/QuestionField' },
          },
        },
        required: ['id', 'type', 'title', 'formId', 'createdAt', 'updatedAt'],
      },
      SubmissionResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'resp_1' },
          formId: { type: 'string', example: 'mKAvXQ' },
          questionId: { type: 'string', example: 'q_name' },
          respondentId: { type: 'string', example: 'resp_user_123' },
          submissionId: { type: 'string', nullable: true, example: 'sub_xyz789' },
          sessionUuid: { type: 'string', format: 'uuid', example: 'f32bb456-789a-4bc1-90ef-123456789abc' },
          answer: { description: 'Value answered', example: 'Jane Doe' },
          formattedAnswer: { type: 'string', example: 'Jane Doe' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-02-01T12:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-02-01T12:00:00.000Z' },
        },
        required: ['id', 'formId', 'questionId', 'respondentId', 'sessionUuid', 'answer', 'createdAt', 'updatedAt'],
      },
      Submission: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'sub_xyz789' },
          formId: { type: 'string', example: 'mKAvXQ' },
          isCompleted: { type: 'boolean', example: true },
          submittedAt: { type: 'string', format: 'date-time', example: '2026-02-01T12:00:00.000Z' },
          locale: { type: 'string', nullable: true, example: 'en' },
          previewUrl: { type: 'string', format: 'uri', example: 'https://tally.so/submission/preview/sub_xyz789' },
          pdfUrl: { type: 'string', format: 'uri', example: 'https://tally.so/submission/download/sub_xyz789.pdf' },
          responses: {
            type: 'array',
            items: { $ref: '#/components/schemas/SubmissionResponse' },
          },
        },
        required: ['id', 'formId', 'isCompleted', 'submittedAt', 'responses'],
      },
      PaginatedFormsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/Form' },
              },
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 50 },
              total: { type: 'integer', example: 1 },
              hasMore: { type: 'boolean', example: false },
            },
            required: ['items', 'page', 'limit', 'total', 'hasMore'],
          },
        },
      },
      PaginatedSubmissionsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 50 },
              hasMore: { type: 'boolean', example: false },
              totalNumberOfSubmissionsPerFilter: {
                type: 'object',
                properties: {
                  all: { type: 'integer', example: 42 },
                  completed: { type: 'integer', example: 40 },
                  partial: { type: 'integer', example: 2 },
                },
              },
              questions: {
                type: 'array',
                items: { $ref: '#/components/schemas/Question' },
              },
              submissions: {
                type: 'array',
                items: { $ref: '#/components/schemas/Submission' },
              },
            },
            required: ['page', 'limit', 'hasMore', 'questions', 'submissions'],
          },
        },
      },
      FormMetrics: {
        type: 'object',
        properties: {
          visits: { type: 'integer', example: 150 },
          submissions: { type: 'integer', example: 42 },
          completionRate: { type: 'number', example: 28.0 },
          averageTime: { type: 'number', example: 110.5 },
        },
      },
      FormVisits: {
        type: 'object',
        properties: {
          period: { type: 'string', example: '30d' },
          visits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', example: '2026-02-01' },
                count: { type: 'integer', example: 12 },
              },
            },
          },
        },
      },
      FormSubmissionAnalytics: {
        type: 'object',
        properties: {
          period: { type: 'string', example: '30d' },
          submissions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', example: '2026-02-01' },
                completed: { type: 'integer', example: 8 },
                partial: { type: 'integer', example: 1 },
              },
            },
          },
        },
      },
      FormDimensions: {
        type: 'object',
        properties: {
          period: { type: 'string', example: 'all' },
          dimensions: {
            type: 'object',
            properties: {
              browsers: { type: 'object', example: { Chrome: 80, Safari: 20 } },
              countries: { type: 'object', example: { US: 65, UK: 35 } },
            },
          },
        },
      },
      FormDropOff: {
        type: 'object',
        properties: {
          period: { type: 'string', example: '30d' },
          dropOff: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                questionId: { type: 'string', example: 'q_phone' },
                dropOffCount: { type: 'integer', example: 5 },
                dropOffRate: { type: 'number', example: 11.9 },
              },
            },
          },
        },
      },
      Workspace: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ws_123' },
          name: { type: 'string', example: 'Marketing Team' },
          organizationId: { type: 'string', example: 'org_xyz789' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-01-10T09:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-01-10T09:00:00.000Z' },
          members: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'usr_abc123' },
                email: { type: 'string', format: 'email', example: 'jane@example.com' },
                role: { type: 'string', example: 'ADMIN' },
              },
            },
          },
        },
        required: ['id', 'name'],
      },
      CreateWorkspaceRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Engineering Team', description: 'Workspace name' },
        },
        required: ['name'],
      },
      Folder: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'fld_456' },
          name: { type: 'string', example: 'Q1 Surveys' },
          workspaceId: { type: 'string', example: 'ws_123' },
          parentId: { type: 'string', nullable: true, example: null },
          createdAt: { type: 'string', format: 'date-time', example: '2026-01-15T10:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-01-15T10:00:00.000Z' },
        },
        required: ['id', 'name', 'workspaceId'],
      },
      CreateFolderRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Q1 Surveys' },
          parentId: { type: 'string', description: 'Parent folder ID to nest under', example: 'fld_root' },
        },
        required: ['name'],
      },
      Webhook: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'wh_789' },
          formId: { type: 'string', example: 'mKAvXQ' },
          url: { type: 'string', format: 'uri', example: 'https://api.myplatform.com/webhooks/tally' },
          eventTypes: {
            type: 'array',
            items: { type: 'string' },
            example: ['FORM_SUBMISSION'],
          },
          isEnabled: { type: 'boolean', example: true },
          signingSecret: { type: 'string', nullable: true, example: 'whsec_sample_secret' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-02-01T10:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-02-01T10:00:00.000Z' },
        },
        required: ['id', 'formId', 'url', 'eventTypes'],
      },
      CreateWebhookRequest: {
        type: 'object',
        properties: {
          formId: { type: 'string', example: 'mKAvXQ' },
          url: { type: 'string', format: 'uri', example: 'https://api.myplatform.com/webhooks/tally' },
          eventTypes: {
            type: 'array',
            items: { type: 'string' },
            example: ['FORM_SUBMISSION'],
          },
          signingSecret: { type: 'string', nullable: true, example: 'whsec_secret' },
        },
        required: ['formId', 'url', 'eventTypes'],
      },
      UpdateWebhookRequest: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri', example: 'https://api.myplatform.com/new-endpoint' },
          eventTypes: {
            type: 'array',
            items: { type: 'string' },
            example: ['FORM_SUBMISSION', 'FORM_UPDATED'],
          },
          isEnabled: { type: 'boolean', example: true },
          signingSecret: { type: 'string', nullable: true, example: 'whsec_secret' },
        },
      },
      WebhookEvent: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'evt_123' },
          webhookId: { type: 'string', example: 'wh_789' },
          eventType: { type: 'string', example: 'FORM_SUBMISSION' },
          status: { type: 'string', example: 'DELIVERED' },
          responseStatus: { type: 'integer', example: 200 },
          attempts: { type: 'integer', example: 1 },
          createdAt: { type: 'string', format: 'date-time', example: '2026-02-01T12:00:00.000Z' },
        },
        required: ['id', 'webhookId', 'eventType', 'status', 'createdAt'],
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Service health check',
        description: 'Returns the health status, uptime, and current server timestamp.',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    uptime: { type: 'number', example: 124.5 },
                    timestamp: { type: 'string', format: 'date-time', example: '2026-02-01T12:00:00.000Z' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get current user information',
        description: 'Returns information about the current authenticated user on Tally.',
        parameters: [
          {
            name: 'timezone',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'IANA timezone identifier (e.g., Europe/Brussels) to update stored timezone',
            example: 'Europe/Brussels',
          },
        ],
        responses: {
          200: {
            description: 'User information retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          400: { description: 'Invalid query parameters', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          502: { description: 'Tally upstream error or invalid server credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/organizations/{organizationId}/users': {
      get: {
        tags: ['Organizations'],
        summary: 'List organization users',
        description: 'Returns a list of all users in the specified organization.',
        parameters: [
          {
            name: 'organizationId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Organization ID',
            example: 'org_123',
          },
        ],
        responses: {
          200: {
            description: 'List of organization users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        users: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/User' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Invalid parameters', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Organization not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/organizations/{organizationId}/users/{userId}': {
      delete: {
        tags: ['Organizations'],
        summary: 'Remove user from organization',
        description: 'Removes a user from your organization.',
        parameters: [
          { name: 'organizationId', in: 'path', required: true, schema: { type: 'string' }, example: 'org_123' },
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' }, example: 'usr_456' },
        ],
        responses: {
          200: {
            description: 'User removed successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardMessageResponse' } } },
          },
          404: { description: 'User or organization not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/organizations/{organizationId}/invites': {
      get: {
        tags: ['Organizations'],
        summary: 'List organization invites',
        description: 'Returns a list of all pending invites in your organization.',
        parameters: [
          { name: 'organizationId', in: 'path', required: true, schema: { type: 'string' }, example: 'org_123' },
        ],
        responses: {
          200: {
            description: 'List of pending invites',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        invites: { type: 'array', items: { $ref: '#/components/schemas/OrganizationInvite' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Organizations'],
        summary: 'Create organization invites',
        description: 'Invites users to join specific workspaces within your organization.',
        parameters: [
          { name: 'organizationId', in: 'path', required: true, schema: { type: 'string' }, example: 'org_123' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrganizationInviteRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Invite(s) created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/OrganizationInvite' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/organizations/{organizationId}/invites/{inviteId}': {
      delete: {
        tags: ['Organizations'],
        summary: 'Cancel an organization invite',
        description: 'Cancels a pending invitation to join workspaces within your organization.',
        parameters: [
          { name: 'organizationId', in: 'path', required: true, schema: { type: 'string' }, example: 'org_123' },
          { name: 'inviteId', in: 'path', required: true, schema: { type: 'string' }, example: 'inv_456' },
        ],
        responses: {
          200: {
            description: 'Invite cancelled successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardMessageResponse' } } },
          },
        },
      },
    },
    '/api/forms': {
      get: {
        tags: ['Forms'],
        summary: 'List forms',
        description: 'Returns a paginated array of form objects with optional workspace filtering.',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 500 }, description: 'Items per page' },
          { name: 'workspaceIds', in: 'query', schema: { type: 'string' }, description: 'Comma-separated workspace IDs', example: 'ws_1,ws_2' },
        ],
        responses: {
          200: {
            description: 'Paginated list of forms',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedFormsResponse' } } },
          },
          400: { description: 'Invalid query parameters', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          429: { description: 'Rate limit reached', headers: { 'Retry-After': { schema: { type: 'integer' } } }, content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        tags: ['Forms'],
        summary: 'Create a new form',
        description: 'Creates a form with specified status, blocks, and settings.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateFormRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Form created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/FormDetails' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/forms/{formId}': {
      get: {
        tags: ['Forms'],
        summary: 'Get form details',
        description: 'Returns a single form by its ID with all its blocks and settings.',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
        ],
        responses: {
          200: {
            description: 'Form retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/FormDetails' },
                  },
                },
              },
            },
          },
          404: { description: 'Form not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      patch: {
        tags: ['Forms'],
        summary: 'Update form',
        description: 'Updates a form name, status, blocks, or settings.',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateFormRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Form updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/FormDetails' },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Forms'],
        summary: 'Delete form',
        description: 'Deletes a form by its ID and moves it to trash.',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
        ],
        responses: {
          200: {
            description: 'Form deleted successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardMessageResponse' } } },
          },
        },
      },
    },
    '/api/forms/{formId}/questions': {
      get: {
        tags: ['Forms'],
        summary: 'List form questions',
        description: 'Returns a list of all questions in a form.',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
        ],
        responses: {
          200: {
            description: 'List of form questions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        questions: { type: 'array', items: { $ref: '#/components/schemas/Question' } },
                        hasResponses: { type: 'boolean', example: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/forms/{formId}/submissions': {
      get: {
        tags: ['Submissions'],
        summary: 'List form submissions',
        description: 'Returns a paginated list of form submissions with responses and question definitions.',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 500 }, description: 'Submissions per page' },
          { name: 'filter', in: 'query', schema: { type: 'string', enum: ['all', 'completed', 'partial'] }, description: 'Submission status filter' },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'Filter on or after ISO 8601 date' },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'Filter on or before ISO 8601 date' },
          { name: 'afterId', in: 'query', schema: { type: 'string' }, description: 'Cursor pagination after submission ID' },
        ],
        responses: {
          200: {
            description: 'List of submissions',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedSubmissionsResponse' } } },
          },
          400: { description: 'Invalid query parameters', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/forms/{formId}/submissions/{submissionId}': {
      get: {
        tags: ['Submissions'],
        summary: 'Get form submission',
        description: 'Returns a specific form submission with all its responses and question schemas.',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
          { name: 'submissionId', in: 'path', required: true, schema: { type: 'string' }, example: 'sub_xyz789' },
        ],
        responses: {
          200: {
            description: 'Submission retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        questions: { type: 'array', items: { $ref: '#/components/schemas/Question' } },
                        submission: { $ref: '#/components/schemas/Submission' },
                      },
                    },
                  },
                },
              },
            },
          },
          404: { description: 'Submission or form not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['Submissions'],
        summary: 'Delete form submission',
        description: 'Deletes a specific submission from a form.',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
          { name: 'submissionId', in: 'path', required: true, schema: { type: 'string' }, example: 'sub_xyz789' },
        ],
        responses: {
          200: {
            description: 'Submission deleted successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardMessageResponse' } } },
          },
        },
      },
    },
    '/api/analytics/forms/{formId}/metrics': {
      get: {
        tags: ['Analytics'],
        summary: 'Get form metrics',
        description: 'Returns aggregate metrics for a form (visits, submissions, completion rate, average time).',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
          {
            name: 'period',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['today', 'yesterday', '24h', '7d', '30d', '3m', '6m', '12m', 'all'] },
            example: '30d',
          },
        ],
        responses: {
          200: {
            description: 'Metrics retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/FormMetrics' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/analytics/forms/{formId}/visits': {
      get: {
        tags: ['Analytics'],
        summary: 'Get form visits',
        description: 'Returns visit counts for a form over time.',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
          { name: 'period', in: 'query', required: true, schema: { type: 'string', enum: ['today', 'yesterday', '24h', '7d', '30d', '3m', '6m', '12m', 'all'] }, example: '7d' },
        ],
        responses: {
          200: {
            description: 'Visits retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/FormVisits' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/analytics/forms/{formId}/submissions': {
      get: {
        tags: ['Analytics'],
        summary: 'Get form submissions analytics',
        description: 'Returns completed and partial submission counts for a form over time.',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
          { name: 'period', in: 'query', required: true, schema: { type: 'string', enum: ['today', 'yesterday', '24h', '7d', '30d', '3m', '6m', '12m', 'all'] }, example: '30d' },
        ],
        responses: {
          200: {
            description: 'Submission analytics retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/FormSubmissionAnalytics' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/analytics/forms/{formId}/dimensions': {
      get: {
        tags: ['Analytics'],
        summary: 'Get form visitor dimensions',
        description: 'Returns visitor breakdowns by source, browser, OS, device, location, and language.',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
          { name: 'period', in: 'query', required: true, schema: { type: 'string', enum: ['today', 'yesterday', '24h', '7d', '30d', '3m', '6m', '12m', 'all'] }, example: 'all' },
        ],
        responses: {
          200: {
            description: 'Dimensions retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/FormDimensions' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/analytics/forms/{formId}/drop-off': {
      get: {
        tags: ['Analytics'],
        summary: 'Get form question drop-off statistics',
        description: 'Returns per-question drop-off counts and rates for a form.',
        parameters: [
          { name: 'formId', in: 'path', required: true, schema: { type: 'string' }, example: 'mKAvXQ' },
          { name: 'period', in: 'query', required: true, schema: { type: 'string', enum: ['today', 'yesterday', '24h', '7d', '30d', '3m', '6m', '12m', 'all'] }, example: 'today' },
        ],
        responses: {
          200: {
            description: 'Drop-off stats retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/FormDropOff' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/workspaces': {
      get: {
        tags: ['Workspaces'],
        summary: 'List workspaces',
        description: 'Returns a paginated array of workspace objects with associated members.',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          200: {
            description: 'Workspaces retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        workspaces: { type: 'array', items: { $ref: '#/components/schemas/Workspace' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Workspaces'],
        summary: 'Create workspace',
        description: 'Creates a new workspace and assigns the authenticated user as a member.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateWorkspaceRequest' } } },
        },
        responses: {
          201: {
            description: 'Workspace created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Workspace' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/workspaces/{workspaceId}': {
      get: {
        tags: ['Workspaces'],
        summary: 'Get workspace',
        description: 'Returns a single workspace by its ID with associated members.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' }, example: 'ws_123' },
        ],
        responses: {
          200: {
            description: 'Workspace retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Workspace' },
                  },
                },
              },
            },
          },
          404: { description: 'Workspace not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      patch: {
        tags: ['Workspaces'],
        summary: 'Update workspace',
        description: 'Updates a workspace name by its ID.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' }, example: 'ws_123' },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateWorkspaceRequest' } } },
        },
        responses: {
          200: {
            description: 'Workspace updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Workspace' },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Workspaces'],
        summary: 'Delete workspace',
        description: 'Deletes a workspace and moves its associated forms to trash.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' }, example: 'ws_123' },
        ],
        responses: {
          200: {
            description: 'Workspace deleted',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardMessageResponse' } } },
          },
        },
      },
    },
    '/api/workspaces/{workspaceId}/folders': {
      get: {
        tags: ['Folders'],
        summary: 'List folders',
        description: 'Returns all folders in a workspace.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' }, example: 'ws_123' },
        ],
        responses: {
          200: {
            description: 'Folders retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        folders: { type: 'array', items: { $ref: '#/components/schemas/Folder' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Folders'],
        summary: 'Create folder',
        description: 'Creates a folder in a workspace (with optional parentId for nesting).',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' }, example: 'ws_123' },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateFolderRequest' } } },
        },
        responses: {
          201: {
            description: 'Folder created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Folder' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/workspaces/{workspaceId}/folders/{id}': {
      patch: {
        tags: ['Folders'],
        summary: 'Rename folder',
        description: 'Renames a folder by its ID.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' }, example: 'ws_123' },
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'fld_456' },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateWorkspaceRequest' } } },
        },
        responses: {
          200: {
            description: 'Folder updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Folder' },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Folders'],
        summary: 'Delete folder',
        description: 'Deletes a folder and moves contained forms to trash.',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' }, example: 'ws_123' },
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'fld_456' },
        ],
        responses: {
          200: {
            description: 'Folder deleted',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardMessageResponse' } } },
          },
        },
      },
    },
    '/api/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhooks',
        description: 'Returns a paginated list of all webhooks across accessible forms.',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 500 } },
        ],
        responses: {
          200: {
            description: 'Webhooks retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        webhooks: { type: 'array', items: { $ref: '#/components/schemas/Webhook' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Create webhook',
        description: 'Creates a new webhook for a form to receive form events.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateWebhookRequest' } } },
        },
        responses: {
          201: {
            description: 'Webhook created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Webhook' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/webhooks/{webhookId}': {
      patch: {
        tags: ['Webhooks'],
        summary: 'Update webhook',
        description: 'Updates an existing webhook configuration.',
        parameters: [
          { name: 'webhookId', in: 'path', required: true, schema: { type: 'string' }, example: 'wh_789' },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateWebhookRequest' } } },
        },
        responses: {
          200: {
            description: 'Webhook updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Webhook' },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Webhooks'],
        summary: 'Delete webhook',
        description: 'Deletes a webhook configuration.',
        parameters: [
          { name: 'webhookId', in: 'path', required: true, schema: { type: 'string' }, example: 'wh_789' },
        ],
        responses: {
          200: {
            description: 'Webhook deleted',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardMessageResponse' } } },
          },
        },
      },
    },
    '/api/webhooks/{webhookId}/events': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhook delivery events',
        description: 'Returns delivery status, response codes, and retry history for a specific webhook.',
        parameters: [
          { name: 'webhookId', in: 'path', required: true, schema: { type: 'string' }, example: 'wh_789' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          200: {
            description: 'Events retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        events: { type: 'array', items: { $ref: '#/components/schemas/WebhookEvent' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/webhooks/{webhookId}/events/{eventId}': {
      post: {
        tags: ['Webhooks'],
        summary: 'Retry webhook event',
        description: 'Retries delivering a failed webhook payload.',
        parameters: [
          { name: 'webhookId', in: 'path', required: true, schema: { type: 'string' }, example: 'wh_789' },
          { name: 'eventId', in: 'path', required: true, schema: { type: 'string' }, example: 'evt_123' },
        ],
        responses: {
          200: {
            description: 'Retry initiated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'evt_123' },
                        status: { type: 'string', example: 'PENDING' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const swaggerOptions: swaggerJsdoc.Options = {
  swaggerDefinition,
  apis: [], // All paths and component schemas are declared and type-checked above
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);

export function setupSwagger(app: Application): void {
  // Expose raw OpenAPI JSON spec
  app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Tally API Mediator Documentation',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    })
  );
}
