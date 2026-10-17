import type {
  PlatformAuthUser,
  Organization,
  TenantAuthUser,
} from "~/types/user";

/** Standard response envelope returned by the NestJS backend. */
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

/** Normalized error thrown by the axios response interceptor. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

/** `data` payload of a successful tenanted login/register. */
export interface TenantAuthData {
  access_token: string;
  token_type: string;
  user: TenantAuthUser;
  organization: Organization;
}

/** `data` payload of a successful platform login/register. */
export interface PlatformAuthData {
  access_token: string;
  token_type: string;
  user: PlatformAuthUser;
}
