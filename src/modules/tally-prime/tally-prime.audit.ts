/**
 * Audit trail for TallyPrime administrative operations.
 * Each entry records who acted, what they did, the target and the outcome.
 * Request bodies, tokens and TallyPrime payloads are never logged.
 */

export interface AuditEntry {
  actor: string;
  operation: string;
  target: string;
  outcome: 'success' | 'rejected' | 'failed';
  status: number;
  code?: string;
}

export function auditLog(entry: AuditEntry): void {
  console.info(
    JSON.stringify({
      type: 'audit',
      timestamp: new Date().toISOString(),
      ...entry,
    })
  );
}
