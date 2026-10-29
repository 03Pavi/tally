/**
 * Settings that an admin can change while the server runs. They are held in memory only:
 * a restart returns to the values from the environment. Every reader consults these first,
 * so a change applies to the next request.
 */

export interface RuntimeSettings {
  /** Overrides TALLY_PRIME_URL when set. Validated by the TallyPrime client on use. */
  tallyPrimeUrl?: string;
  /** Overrides ADMIN_API_TOKEN when set. Length is checked when it is set. */
  adminToken?: string;
}

const settings: RuntimeSettings = {};

export function getRuntimeSettings(): Readonly<RuntimeSettings> {
  return { ...settings };
}

export function setRuntimeSettings(update: RuntimeSettings): void {
  if (update.tallyPrimeUrl !== undefined) settings.tallyPrimeUrl = update.tallyPrimeUrl;
  if (update.adminToken !== undefined) settings.adminToken = update.adminToken;
}

/** The admin token in effect: the runtime value if set, otherwise ADMIN_API_TOKEN from the environment. */
export function currentAdminToken(): string {
  return settings.adminToken ?? process.env['ADMIN_API_TOKEN'] ?? '';
}

/** Test helper. Not used by the application. */
export function resetRuntimeSettings(): void {
  delete settings.tallyPrimeUrl;
  delete settings.adminToken;
}
