export type SubscriptionPlan = 'FREE' | 'PRO' | 'BUSINESS' | string;

export interface User {
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
  subscriptionPlan: SubscriptionPlan;
}

export interface GetCurrentUserQuery {
  timezone?: string;
}
