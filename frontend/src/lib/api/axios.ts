import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { apiConfig } from "~/config/api-config";
import { ApiError, type ApiResponse } from "~/types/api";

/** Auth context resolved per-request (token + optional tenant slug). */
export interface AuthContext {
  accessToken?: string;
  tenantSlug?: string | null;
}

export type AuthContextResolver = () => Promise<AuthContext | null>;

/**
 * Build an axios instance whose request interceptor injects the bearer token
 * and `x-tenant-id` header from `resolveAuth`, and whose response interceptor
 * unwraps the `{ data }` envelope and normalizes errors to `ApiError`.
 *
 * `onUnauthorized` lets the client variant sign the user out on a 401.
 */
export function createApiClient(
  resolveAuth: AuthContextResolver,
  onUnauthorized?: () => void,
): AxiosInstance {
  const instance = axios.create({
    baseURL: apiConfig.baseUrl,
    headers: { "Content-Type": "application/json" },
  });

  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const ctx = await resolveAuth();
      if (ctx?.accessToken && !config.headers.has("Authorization")) {
        config.headers.set("Authorization", `Bearer ${ctx.accessToken}`);
      }
      // Don't clobber an explicitly-set tenant header (e.g. apex registration).
      if (ctx?.tenantSlug && !config.headers.has(apiConfig.tenantHeader)) {
        config.headers.set(apiConfig.tenantHeader, ctx.tenantSlug);
      }
      return config;
    },
  );

  instance.interceptors.response.use(
    (response) => {
      // Unwrap the standard envelope so callers receive `data` directly.
      const body = response.data as ApiResponse<unknown> | undefined;
      if (body && typeof body === "object" && "data" in body) {
        response.data = body.data;
      }
      return response;
    },
    (error) => {
      const status: number = error.response?.status ?? 0;
      const message: string =
        error.response?.data?.message ?? error.message ?? "Request failed";
      if (status === 401) onUnauthorized?.();
      return Promise.reject(new ApiError(message, status));
    },
  );

  return instance;
}

/** Typed request helpers over an instance that already unwraps the envelope. */
export function makeHttp(instance: AxiosInstance) {
  return {
    get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
      (await instance.get<unknown, { data: T }>(url, config)).data,
    post: async <T>(
      url: string,
      body?: unknown,
      config?: AxiosRequestConfig,
    ): Promise<T> =>
      (await instance.post<unknown, { data: T }>(url, body, config)).data,
    patch: async <T>(
      url: string,
      body?: unknown,
      config?: AxiosRequestConfig,
    ): Promise<T> =>
      (await instance.patch<unknown, { data: T }>(url, body, config)).data,
    put: async <T>(
      url: string,
      body?: unknown,
      config?: AxiosRequestConfig,
    ): Promise<T> =>
      (await instance.put<unknown, { data: T }>(url, body, config)).data,
    delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
      (await instance.delete<unknown, { data: T }>(url, config)).data,
  };
}
