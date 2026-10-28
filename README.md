# Tally API Service

Production-ready, type-safe Express.js + TypeScript microservice integrating with the official [Tally API](https://developers.tally.so).

## API Documentation & Swagger UI

- **Interactive Swagger UI**: [`http://localhost:3000/api-docs`](http://localhost:3000/api-docs)
- **OpenAPI 3 Specification (JSON)**: [`http://localhost:3000/api-docs.json`](http://localhost:3000/api-docs.json)

---

## Modular Feature Architecture

Each domain is organized as a dedicated, self-contained feature folder under `src/modules/` with its own types, validation schemas, services, controllers, routes, and test suites:

```text
src/
├── config/
│   ├── env.ts                       # Validated environment configuration (Zod)
│   └── env.test.ts
├── client/
│   ├── tally.client.ts              # Centralized HTTP client (auth, retry, timeout, error mapping)
│   └── tally.client.test.ts
├── middleware/
│   ├── error-handler.ts             # Centralized error handler & status mapper
│   └── validate.ts                  # Generic Zod validation middleware
├── utils/
│   └── async-handler.ts             # Async route handler wrapper
├── modules/
│   ├── users/                       # Users feature module
│   │   ├── users.types.ts
│   │   ├── users.validators.ts
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   ├── users.routes.ts
│   │   └── users.test.ts
│   ├── organizations/               # Organizations & Invites feature module
│   │   ├── organizations.types.ts
│   │   ├── organizations.validators.ts
│   │   ├── organizations.service.ts
│   │   ├── organizations.controller.ts
│   │   ├── organizations.routes.ts
│   │   └── organizations.test.ts
│   ├── forms/                       # Forms, Questions, & Submissions feature module
│   │   ├── forms.types.ts
│   │   ├── forms.validators.ts
│   │   ├── forms.service.ts
│   │   ├── forms.controller.ts
│   │   ├── forms.routes.ts
│   │   └── forms.test.ts
│   ├── analytics/                   # Analytics feature module
│   │   ├── analytics.types.ts
│   │   ├── analytics.validators.ts
│   │   ├── analytics.service.ts
│   │   ├── analytics.controller.ts
│   │   ├── analytics.routes.ts
│   │   └── analytics.test.ts
│   ├── workspaces/                  # Workspaces feature module
│   │   ├── workspaces.types.ts
│   │   ├── workspaces.validators.ts
│   │   ├── workspaces.service.ts
│   │   ├── workspaces.controller.ts
│   │   ├── workspaces.routes.ts
│   │   └── workspaces.test.ts
│   ├── folders/                     # Workspace Folders feature module
│   │   ├── folders.types.ts
│   │   ├── folders.validators.ts
│   │   ├── folders.service.ts
│   │   ├── folders.controller.ts
│   │   ├── folders.routes.ts
│   │   └── folders.test.ts
│   ├── webhooks/                    # Webhooks & Delivery Events feature module
│   │   ├── webhooks.types.ts
│   │   ├── webhooks.validators.ts
│   │   ├── webhooks.service.ts
│   │   ├── webhooks.controller.ts
│   │   ├── webhooks.routes.ts
│   │   └── webhooks.test.ts
│   └── tally/                       # Unified legacy router (backward-compatible)
├── app.ts                           # Express app factory with feature route mounts
├── app.test.ts
└── server.ts                        # Application server entrypoint with graceful shutdown
```

---

## Supported Endpoints by Feature Module

### 1. Users (`/api/users`)
- `GET /api/users/me` — Retrieve current authenticated user profile (`users/me/get`)

### 2. Organizations (`/api/organizations`)
- `GET /api/organizations/:organizationId/users` — List users in organization (`organizations/users/get`)
- `DELETE /api/organizations/:organizationId/users/:userId` — Remove user from organization (`organizations/users/delete`)
- `GET /api/organizations/:organizationId/invites` — List organization invites (`organizations/invites/get`)
- `POST /api/organizations/:organizationId/invites` — Invite users to workspace (`organizations/invites/post`)
- `DELETE /api/organizations/:organizationId/invites/:inviteId` — Cancel organization invite (`organizations/invites/delete`)

### 3. Forms (`/api/forms`)
- `GET /api/forms` — List forms with pagination & workspace filters (`forms/list`)
- `POST /api/forms` — Create a new form (`forms/post`)
- `GET /api/forms/:formId` — Retrieve form details, blocks, and settings (`forms/get`)
- `PATCH /api/forms/:formId` — Update form settings, blocks, or status (`forms/patch`)
- `DELETE /api/forms/:formId` — Delete form and move to trash (`forms/delete`)
- `GET /api/forms/:formId/questions` — List form questions (`forms/questions/list`)
- `GET /api/forms/:formId/submissions` — List submissions with filters (`forms/submissions/list`)
- `GET /api/forms/:formId/submissions/:submissionId` — Retrieve submission details (`forms/submissions/get`)
- `DELETE /api/forms/:formId/submissions/:submissionId` — Delete a submission (`forms/submissions/delete`)

### 4. Analytics (`/api/analytics`)
- `GET /api/analytics/forms/:formId/metrics` — Aggregate form metrics (`analytics/metrics`)
- `GET /api/analytics/forms/:formId/visits` — Visit counts over time (`analytics/visits`)
- `GET /api/analytics/forms/:formId/submissions` — Submissions count over time (`analytics/submissions`)
- `GET /api/analytics/forms/:formId/dimensions` — Visitor breakdowns by source, OS, device (`analytics/dimensions`)
- `GET /api/analytics/forms/:formId/drop-off` — Per-question drop-off stats (`analytics/drop-off`)

### 5. Workspaces (`/api/workspaces`)
- `GET /api/workspaces` — List workspaces with pagination (`workspaces/list`)
- `POST /api/workspaces` — Create a new workspace (`workspaces/post`)
- `GET /api/workspaces/:workspaceId` — Retrieve workspace with members (`workspaces/get`)
- `PATCH /api/workspaces/:workspaceId` — Update workspace name (`workspaces/patch`)
- `DELETE /api/workspaces/:workspaceId` — Delete workspace and forms (`workspaces/delete`)

### 6. Folders (`/api/workspaces/:workspaceId/folders`)
- `GET /api/workspaces/:workspaceId/folders` — List folders in a workspace (`folders/list`)
- `POST /api/workspaces/:workspaceId/folders` — Create a folder (`folders/post`)
- `PATCH /api/workspaces/:workspaceId/folders/:id` — Rename a folder (`folders/patch`)
- `DELETE /api/workspaces/:workspaceId/folders/:id` — Delete a folder subtree (`folders/delete`)

### 7. Webhooks (`/api/webhooks`)
- `GET /api/webhooks` — List configured webhooks (`webhooks/get`)
- `POST /api/webhooks` — Create a webhook for a form (`webhooks/post`)
- `PATCH /api/webhooks/:webhookId` — Update webhook URL/event types (`webhooks/patch`)
- `DELETE /api/webhooks/:webhookId` — Delete a webhook (`webhooks/delete`)
- `GET /api/webhooks/:webhookId/events` — List delivery events (`webhooks/events/get`)
- `POST /api/webhooks/:webhookId/events/:eventId` — Retry a failed webhook event (`webhooks/events/retry`)

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TALLY_API_KEY` | **Yes** | - | Your Tally API Bearer token |
| `PORT` | No | `3000` | HTTP port |
| `NODE_ENV` | No | `development` | Runtime environment |
| `TALLY_API_BASE_URL` | No | `https://api.tally.so` | Must use HTTPS |
| `TALLY_REQUEST_TIMEOUT_MS` | No | `10000` | Inbound/outbound request timeout |
| `TALLY_MAX_RETRIES` | No | `2` | Max retry attempts for retryable errors |

---

## Validation & Testing

```bash
# Run all unit and integration tests
npm test

# Run tests with coverage
npm run test:coverage

# TypeScript compile verification
npm run typecheck

# Production build
npm run build
```
