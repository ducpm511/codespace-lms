// Hợp đồng user. Chỉ type — decorator validate ở apps/api.

export type UserStatusValue = 'invited' | 'active' | 'suspended';

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  status: string;
  roles: string[];
  createdAt: string;
}

export interface UserDetail extends UserSummary {
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  status?: UserStatusValue;
  roleKeys?: string[];
}

export interface UpdateUserRequest {
  fullName?: string;
  status?: UserStatusValue;
  avatarUrl?: string | null;
}
