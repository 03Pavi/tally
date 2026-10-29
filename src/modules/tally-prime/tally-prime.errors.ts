export interface TallyPrimeErrorParams {
  message: string;
  /** HTTP status returned to the client. */
  status: number;
  /** Machine-readable code. Connection codes start with TALLYPRIME_; others reuse the shared vocabulary. */
  code: string;
  upstreamStatus?: number;
  details?: unknown;
}

/**
 * Error raised by the TallyPrime adapter. Messages are safe to return to clients:
 * they never contain raw XML, credentials or accounting payloads.
 */
export class TallyPrimeError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly upstreamStatus?: number;
  public readonly details?: unknown;

  constructor(params: TallyPrimeErrorParams) {
    super(params.message);
    this.name = 'TallyPrimeError';
    this.status = params.status;
    this.code = params.code;
    this.upstreamStatus = params.upstreamStatus;
    this.details = params.details;
    Object.setPrototypeOf(this, TallyPrimeError.prototype);
  }
}
