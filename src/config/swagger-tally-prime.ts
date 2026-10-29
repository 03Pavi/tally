/**
 * OpenAPI paths for the TallyPrime admin API. Merged into the main spec in swagger.ts.
 * Every operation requires the admin bearer token. Operations marked "Modifies" change accounting
 * data in TallyPrime. Destructive operations also need confirm=true.
 */

const bearer = [{ bearerAuth: [] }];

const err = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
});

const authErrors = {
  '401': err('Missing or invalid admin token'),
  '503': err('Admin API not configured: ADMIN_API_TOKEN is missing or shorter than 32 characters'),
};

const connectionErrors = {
  '502': err('TallyPrime rejected or returned a malformed response (TALLYPRIME business errors arrive as 422 with details)'),
  '503': err('TallyPrime not reachable: not running, or its integration server is disabled or on another port'),
  '504': err('TallyPrime did not respond within the configured timeout'),
};

const ok = (description: string, data: Record<string, unknown>) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { success: { type: 'boolean', example: true }, data },
      },
    },
  },
});

const pathParam = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string', maxLength: 300 },
  description,
});

const confirmParam = {
  name: 'confirm',
  in: 'query',
  required: true,
  schema: { type: 'string', enum: ['true'] },
  description: 'Must be true. Destructive operations are refused without it.',
};

const jsonBody = (schemaRef: string, example: Record<string, unknown>) => ({
  required: true,
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaRef}` }, example } },
});

const ledgerExample = {
  name: 'Bright Supplies',
  parent: 'Sundry Creditors',
  openingBalance: -5000,
  gstin: '27AAAPL1234C1ZV',
  addressLines: ['Plot 12', 'Pune'],
};

const CompanySelectSchema = {
  CompanySelect: {
    type: 'object',
    required: ['name'],
    properties: { name: { type: 'string', maxLength: 200, example: 'Zenmo' } },
    additionalProperties: false,
  },
};

export const tallyPrimeCompanySchemas = CompanySelectSchema;

export const tallyPrimeAdminPaths = {
  '/tally-prime/companies': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'List open companies',
      description: 'Lists the companies TallyPrime currently has open. active marks the company this request uses (see ?company=, POST /companies/select, TALLY_PRIME_COMPANY, or the only open company).',
      security: bearer,
      responses: {
        '200': ok('Open companies', { type: 'array', items: { type: 'object', properties: { name: { type: 'string', example: 'Zenmo' }, guid: { type: 'string', nullable: true }, active: { type: 'boolean', example: true } } } }),
        ...authErrors,
        ...connectionErrors,
      },
    },
  },
  '/tally-prime/companies/current': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'Get the active company',
      description: 'Reads. No request body. Pass ?company=<name> to choose a company for this call. source says where the company came from: request (?company=), runtime (POST /companies/select), configured (TALLY_PRIME_COMPANY), or single-open. When several companies are open and none is chosen, the response has name null, source none and the list of open companies in openCompanies.',
      security: bearer,
      responses: {
        '200': {
          description: 'Active company, or the open companies when none is active',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    required: ['name', 'source'],
                    properties: {
                      name: { type: 'string', nullable: true, example: 'Zenmo', description: 'Active company name, or null when none is active' },
                      source: { type: 'string', enum: ['request', 'runtime', 'configured', 'single-open', 'none'], example: 'request' },
                      openCompanies: {
                        type: 'array',
                        items: { type: 'string' },
                        example: ['Xsxss', 'Zenmo'],
                        description: 'Present only when name is null: the companies TallyPrime has open',
                      },
                    },
                  },
                },
              },
              examples: {
                active: { summary: 'One company is active', value: { success: true, data: { name: 'Zenmo', source: 'request' } } },
                none: { summary: 'Several companies open, none chosen', value: { success: true, data: { name: null, source: 'none', openCompanies: ['Xsxss', 'Zenmo'] } } },
              },
            },
          },
        },
        ...authErrors,
        ...connectionErrors,
      },
    },
  },
  '/tally-prime/companies/select': {
    post: {
      tags: ['TallyPrime Admin'],
      summary: 'Set the default company for later requests',
      description: 'Sets the runtime default company. The name must be a company TallyPrime currently has open, matched without regard to case. Requests that pass ?company= still take precedence. The setting resets when the process restarts. This does not switch the company open in the TallyPrime window.',
      security: bearer,
      requestBody: jsonBody('CompanySelect', { name: 'Zenmo' }),
      responses: {
        '200': ok('Selected', { type: 'object', properties: { name: { type: 'string', example: 'Zenmo' }, source: { type: 'string', enum: ['runtime'] } } }),
        '400': err('Validation error'),
        '404': err('COMPANY_NOT_OPEN: the company is not open in TallyPrime'),
        ...authErrors,
        ...connectionErrors,
      },
    },
    delete: {
      tags: ['TallyPrime Admin'],
      summary: 'Clear the runtime default company',
      description: 'Removes the runtime selection so TALLY_PRIME_COMPANY or the single open company applies again.',
      security: bearer,
      responses: { '200': ok('Cleared', { type: 'object', properties: { cleared: { type: 'boolean', example: true } } }), ...authErrors },
    },
  },
  '/tally-prime/groups': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'List account groups',
      description: 'Reads.',
      security: bearer,
      responses: { '200': ok('Groups', { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, parent: { type: 'string', nullable: true } } } }), ...authErrors, ...connectionErrors },
    },
    post: {
      tags: ['TallyPrime Admin'],
      summary: 'Create an account group',
      description: 'Modifies accounting masters. The parent group must exist. Duplicate names are refused.',
      security: bearer,
      requestBody: jsonBody('GroupCreate', { name: 'Vendor Advances', parent: 'Current Assets' }),
      responses: { '201': ok('Created', { type: 'object' }), '409': err('GROUP_EXISTS'), '422': err('Validation failed or TallyPrime rejected the group'), ...authErrors, ...connectionErrors },
    },
  },
  '/tally-prime/groups/{name}': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'Get one account group',
      description: 'Reads.',
      security: bearer,
      parameters: [pathParam('name', 'Group name, case-insensitive')],
      responses: { '200': ok('Group', { type: 'object' }), '404': err('Group not found'), ...authErrors, ...connectionErrors },
    },
    patch: {
      tags: ['TallyPrime Admin'],
      summary: 'Move a group under another parent',
      description: 'Modifies. Only the parent can change; renaming is not supported. Moves that create a cycle are refused.',
      security: bearer,
      parameters: [pathParam('name', 'Group name')],
      requestBody: jsonBody('GroupPatch', { parent: 'Current Liabilities' }),
      responses: { '200': ok('Updated', { type: 'object' }), '404': err('Group not found'), '422': err('Validation failed or TallyPrime rejected the change'), ...authErrors, ...connectionErrors },
    },
    delete: {
      tags: ['TallyPrime Admin'],
      summary: 'Delete an account group',
      description: 'Modifies and destructive. Requires confirm=true. TallyPrime refuses groups that still hold ledgers.',
      security: bearer,
      parameters: [pathParam('name', 'Group name'), confirmParam],
      responses: { '200': ok('Deleted', { type: 'object' }), '400': err('confirm=true missing'), '404': err('Group not found'), '422': err('TallyPrime rejected the deletion'), ...authErrors, ...connectionErrors },
    },
  },
  '/tally-prime/ledgers': {
    post: {
      tags: ['TallyPrime Admin'],
      summary: 'Create a ledger',
      description: 'Modifies. The parent group must exist. Amounts are signed: positive = debit, negative = credit. Unknown fields are refused.',
      security: bearer,
      requestBody: jsonBody('LedgerCreate', ledgerExample),
      responses: { '201': ok('Created', { type: 'object', properties: { created: { type: 'boolean' }, name: { type: 'string' } } }), '400': err('Validation error'), '409': err('LEDGER_EXISTS'), '422': err('Parent group missing or TallyPrime rejected the ledger'), ...authErrors, ...connectionErrors },
    },
  },
  '/tally-prime/ledgers/{name}': {
    patch: {
      tags: ['TallyPrime Admin'],
      summary: 'Update a ledger',
      description: 'Modifies. Send only the fields to change. Renaming is not supported.',
      security: bearer,
      parameters: [pathParam('name', 'Ledger name')],
      requestBody: jsonBody('LedgerPatch', { addressLines: ['Plot 14', 'Pune'] }),
      responses: { '200': ok('Updated', { type: 'object' }), '400': err('Validation error'), '404': err('Ledger not found'), '422': err('TallyPrime rejected the change'), ...authErrors, ...connectionErrors },
    },
    delete: {
      tags: ['TallyPrime Admin'],
      summary: 'Delete a ledger',
      description: 'Modifies and destructive. Requires confirm=true. TallyPrime refuses ledgers with transactions.',
      security: bearer,
      parameters: [pathParam('name', 'Ledger name'), confirmParam],
      responses: { '200': ok('Deleted', { type: 'object' }), '400': err('confirm=true missing'), '404': err('Ledger not found'), '422': err('TallyPrime rejected the deletion'), ...authErrors, ...connectionErrors },
    },
  },
  '/tally-prime/vendors': {
    post: {
      tags: ['TallyPrime Admin'],
      summary: 'Create a vendor ledger',
      description: 'Modifies. A vendor is a ledger under Sundry Creditors or one of its sub-groups. Defaults to Sundry Creditors.',
      security: bearer,
      requestBody: jsonBody('LedgerCreate', { ...ledgerExample, parent: undefined }),
      responses: { '201': ok('Created', { type: 'object' }), '400': err('Validation error'), '409': err('LEDGER_EXISTS'), '422': err('Parent is outside the vendor group, or TallyPrime rejected it'), ...authErrors, ...connectionErrors },
    },
  },
  '/tally-prime/vendors/{name}': {
    patch: {
      tags: ['TallyPrime Admin'],
      summary: 'Update a vendor ledger',
      description: 'Modifies. Only ledgers under Sundry Creditors can be updated here.',
      security: bearer,
      parameters: [pathParam('name', 'Vendor name')],
      requestBody: jsonBody('LedgerPatch', { gstin: '27AAAPL1234C1ZV' }),
      responses: { '200': ok('Updated', { type: 'object' }), '404': err('Vendor not found'), '422': err('TallyPrime rejected the change'), ...authErrors, ...connectionErrors },
    },
    delete: {
      tags: ['TallyPrime Admin'],
      summary: 'Delete a vendor ledger',
      description: 'Modifies and destructive. Requires confirm=true.',
      security: bearer,
      parameters: [pathParam('name', 'Vendor name'), confirmParam],
      responses: { '200': ok('Deleted', { type: 'object' }), '400': err('confirm=true missing'), '404': err('Vendor not found'), '422': err('TallyPrime rejected the deletion'), ...authErrors, ...connectionErrors },
    },
  },
  '/tally-prime/customers': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'List customer ledgers',
      description: 'Reads. A customer is a ledger under Sundry Debtors or one of its sub-groups.',
      security: bearer,
      parameters: [{ name: 'search', in: 'query', schema: { type: 'string', maxLength: 200 } }],
      responses: { '200': ok('Customers', { type: 'array', items: { $ref: '#/components/schemas/TallyPrimeLedger' } }), ...authErrors, ...connectionErrors },
    },
    post: {
      tags: ['TallyPrime Admin'],
      summary: 'Create a customer ledger',
      description: 'Modifies. Defaults to Sundry Debtors. Parent must be Sundry Debtors or a sub-group.',
      security: bearer,
      requestBody: jsonBody('LedgerCreate', { name: 'Acme Retail', openingBalance: 2500 }),
      responses: { '201': ok('Created', { type: 'object' }), '400': err('Validation error'), '409': err('LEDGER_EXISTS'), '422': err('Parent outside the customer group, or TallyPrime rejected it'), ...authErrors, ...connectionErrors },
    },
  },
  '/tally-prime/customers/outstanding': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'Customer ledger balances',
      description: 'Reads. Ledger closing balances, not bill-wise. receivable = closingBalance, so positive is owed by the customer.',
      security: bearer,
      responses: { '200': ok('Balances', { type: 'array', items: { type: 'object' } }), ...authErrors, ...connectionErrors },
    },
  },
  '/tally-prime/customers/{name}': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'Get one customer ledger',
      description: 'Reads.',
      security: bearer,
      parameters: [pathParam('name', 'Customer name')],
      responses: { '200': ok('Customer', { $ref: '#/components/schemas/TallyPrimeLedger' }), '404': err('Customer not found'), ...authErrors, ...connectionErrors },
    },
    patch: {
      tags: ['TallyPrime Admin'],
      summary: 'Update a customer ledger',
      description: 'Modifies.',
      security: bearer,
      parameters: [pathParam('name', 'Customer name')],
      requestBody: jsonBody('LedgerPatch', { email: 'accounts@acme.example' }),
      responses: { '200': ok('Updated', { type: 'object' }), '404': err('Customer not found'), '422': err('TallyPrime rejected the change'), ...authErrors, ...connectionErrors },
    },
    delete: {
      tags: ['TallyPrime Admin'],
      summary: 'Delete a customer ledger',
      description: 'Modifies and destructive. Requires confirm=true.',
      security: bearer,
      parameters: [pathParam('name', 'Customer name'), confirmParam],
      responses: { '200': ok('Deleted', { type: 'object' }), '400': err('confirm=true missing'), '404': err('Customer not found'), '422': err('TallyPrime rejected the deletion'), ...authErrors, ...connectionErrors },
    },
  },
  '/tally-prime/vouchers': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'List vouchers for a period (also serves as the Day Book)',
      description: 'Reads. fromDate and toDate are required, and the range can span at most 366 days. Header fields only. Ledger entries are not returned.',
      security: bearer,
      parameters: [
        { name: 'fromDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        { name: 'toDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['Sales', 'Purchase', 'Receipt', 'Payment', 'Contra', 'Journal'] } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
        { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
      ],
      responses: { '200': ok('Vouchers', { type: 'array', items: { type: 'object' } }), '400': err('Invalid or too-wide date range'), ...authErrors, ...connectionErrors },
    },
    post: {
      tags: ['TallyPrime Admin'],
      summary: 'Create a voucher',
      description: 'Modifies. Entries must reference existing ledgers and sum to zero (positive = debit, negative = credit). A repeated number on the same date and type is refused. With an Idempotency-Key header, a retry with the same body returns the original response and does not post again. TallyPrime does not guarantee atomicity across the entries of a voucher beyond its own import result.',
      security: bearer,
      parameters: [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', maxLength: 128 } }],
      requestBody: jsonBody('VoucherCreate', {
        type: 'Journal',
        date: '2026-03-31',
        narration: 'Accrual for March',
        entries: [
          { ledger: 'Office Rent', amount: 10000 },
          { ledger: 'Accrued Expenses', amount: -10000 },
        ],
      }),
      responses: {
        '201': ok('Created', { type: 'object' }),
        '400': err('Validation error (unbalanced totals, bad date, unknown field)'),
        '409': err('DUPLICATE_VOUCHER, IDEMPOTENCY_KEY_REUSED or REQUEST_IN_PROGRESS'),
        '422': err('Missing ledgers, or TallyPrime rejected the voucher (details hold its messages)'),
        ...authErrors,
        ...connectionErrors,
      },
    },
  },
  '/tally-prime/vouchers/{type}/{number}': {
    delete: {
      tags: ['TallyPrime Admin'],
      summary: 'Delete a voucher',
      description: 'Modifies and destructive. Requires confirm=true and the voucher date. The type, number and date must match exactly one voucher.',
      security: bearer,
      parameters: [
        { name: 'type', in: 'path', required: true, schema: { type: 'string', enum: ['Sales', 'Purchase', 'Receipt', 'Payment', 'Contra', 'Journal'] } },
        pathParam('number', 'Voucher number'),
        { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        confirmParam,
      ],
      responses: { '200': ok('Deleted', { type: 'object' }), '400': err('confirm=true missing'), '404': err('Voucher not found'), '409': err('More than one voucher matches'), '422': err('TallyPrime rejected the deletion'), ...authErrors, ...connectionErrors },
    },
  },
  '/tally-prime/reports/trial-balance': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'Trial Balance',
      description: 'Reads. Uses the Trial Balance Data report. Lines are grouped by XML element type, not display order. totals is always null. The row structure is unverified against a live export.',
      security: bearer,
      parameters: [
        { name: 'fromDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Provide with toDate, or omit both' },
        { name: 'toDate', in: 'query', schema: { type: 'string', format: 'date' } },
      ],
      responses: { '200': ok('Trial Balance', { $ref: '#/components/schemas/FinancialReport' }), '400': err('Invalid dates'), ...authErrors, ...connectionErrors },
    },
  },
  '/tally-prime/reports/cash-bank': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'Cash and bank summary (not supported)',
      description: 'Always answers 501. Not implemented in this release. Use the trial balance or the ledger list.',
      security: bearer,
      responses: { '501': err('NOT_SUPPORTED'), ...authErrors },
    },
  },
  '/tally-prime/reports/receivables-payables': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'Bill-wise receivables and payables (not supported)',
      description: 'Always answers 501. Bill-wise report parsing is not implemented.',
      security: bearer,
      responses: { '501': err('NOT_SUPPORTED'), ...authErrors },
    },
  },
  '/tally-prime/reports/stock-summary': {
    get: {
      tags: ['TallyPrime Admin'],
      summary: 'Stock summary (not supported)',
      description: 'Always answers 501. Inventory is not implemented in this release.',
      security: bearer,
      responses: { '501': err('NOT_SUPPORTED'), ...authErrors },
    },
  },
};
