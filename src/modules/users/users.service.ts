import { TallyClient } from '../../client/tally.client.js';
import type { User, GetCurrentUserQuery } from './users.types.js';

export class UsersService {
  private readonly client: TallyClient;

  constructor(client?: TallyClient) {
    this.client = client ?? new TallyClient();
  }

  /**
   * Retrieves information about the current authenticated user.
   * Documented endpoint: GET https://api.tally.so/users/me
   */
  public async getCurrentUser(query: GetCurrentUserQuery = {}): Promise<User> {
    const params: Record<string, string | undefined> = {};
    if (query.timezone !== undefined) {
      params['timezone'] = query.timezone;
    }
    return this.client.get<User>('/users/me', { params });
  }
}
