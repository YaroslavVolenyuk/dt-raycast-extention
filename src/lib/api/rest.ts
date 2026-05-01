// src/lib/api/rest.ts
// Generic REST API client for Dynatrace REST endpoints (Config/Platform APIs)
// Handles authentication, error handling, pagination, and mock mode

import { ZodSchema, ZodError } from "zod";
import { getAccessToken, TenantConfig, OAuthError } from "../auth";
import { isMockMode, devLog } from "../devMode";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RestClientOptions<T = unknown> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  schema?: ZodSchema<T>;
  queryParams?: Record<string, string>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface RestResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export class RestError extends Error {
  constructor(
    public statusCode: number,
    public statusText: string,
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "RestError";
  }
}

export class ValidationError extends Error {
  constructor(
    public zodError: ZodError,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class DavisCopilotUnavailableError extends RestError {
  constructor() {
    super(403, "Forbidden", "Davis CoPilot requires a Platform Subscription or is not available in your environment");
    this.name = "DavisCopilotUnavailableError";
  }
}

// ── Mock Registry ─────────────────────────────────────────────────────────────

const mockRegistry = new Map<string | RegExp, unknown>();

export function registerMock(path: string | RegExp, data: unknown): void {
  mockRegistry.set(path, data);
  devLog(`Registered mock for path: ${path}`, { dataType: typeof data });
}

export function clearMocks(): void {
  mockRegistry.clear();
  devLog("Cleared all mocks");
}

export function getMockRegistry(): Map<string | RegExp, unknown> {
  return new Map(mockRegistry);
}

function matchMockPath(path: string): unknown | null {
  for (const [pattern, data] of mockRegistry.entries()) {
    if (typeof pattern === "string") {
      if (path === pattern || path.includes(pattern)) {
        return data;
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(path)) {
        return data;
      }
    }
  }
  return null;
}

// ── Main Function ─────────────────────────────────────────────────────────────

/**
 * Generic REST API client for Dynatrace REST endpoints.
 * Automatically handles OAuth authentication, error handling, and response validation.
 *
 * @param tenant - Tenant configuration
 * @param path - API endpoint path (e.g., "/api/v2/slo", "/platform/automation/v1/workflows")
 * @param options - Request options
 * @returns Promise<RestResponse<T>>
 *
 * @example
 * // GET request with Zod validation
 * const response = await dynatraceRest<SLO[]>(tenant, "/api/v2/slo", {
 *   schema: z.array(sloSchema),
 * });
 *
 * // POST request with body
 * const response = await dynatraceRest(tenant, "/api/v2/events", {
 *   method: "POST",
 *   body: { title: "Test event" },
 * });
 *
 * // GET with query parameters
 * const response = await dynatraceRest(tenant, "/api/v2/settings/objects", {
 *   queryParams: { schemaIds: "builtin:ownership.teams", limit: "100" },
 * });
 */
export async function dynatraceRest<T = unknown>(
  tenant: TenantConfig,
  path: string,
  options: RestClientOptions<T> = {},
): Promise<RestResponse<T>> {
  const { method = "GET", body, schema, queryParams, signal, headers: customHeaders } = options;

  // ── Mock Mode ─────────────────────────────────────────────────────────────
  if (isMockMode()) {
    devLog(`Mock REST call: ${method} ${path}`, { queryParams });

    const mockData = matchMockPath(path);
    if (mockData) {
      devLog(`Mock data found for ${path}`);

      // Validate with schema if provided
      if (schema) {
        try {
          const validated = schema.parse(mockData);
          return {
            data: validated as T,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
          };
        } catch (err) {
          if (err instanceof ZodError) {
            throw new ValidationError(err, `Mock data validation failed for ${path}`);
          }
          throw err;
        }
      }

      return {
        data: mockData as T,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
      };
    }

    // No mock found — log warning and return empty response
    devLog(`No mock data found for ${path}`, { available: Array.from(mockRegistry.keys()) });
    const emptyResponse = schema ? {} : [];
    return {
      data: emptyResponse as T,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
    };
  }

  // ── Real API Call ─────────────────────────────────────────────────────────

  // Get access token
  let token: string;
  try {
    token = await getAccessToken(tenant);
  } catch (err) {
    if (err instanceof OAuthError) {
      throw new RestError(err.statusCode, "OAuth Error", `Failed to obtain access token: ${err.message}`, err);
    }
    throw err;
  }

  // Build URL
  const baseUrl = `${tenant.tenantEndpoint}${path}`;
  let url = baseUrl;

  if (queryParams) {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      params.append(key, value);
    });
    url = `${baseUrl}?${params.toString()}`;
  }

  // Prepare request headers
  const headers = new Headers({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...customHeaders,
  });

  // Prepare request body
  let requestBody: string | undefined;
  if (body && method !== "GET" && method !== "DELETE") {
    requestBody = typeof body === "string" ? body : JSON.stringify(body);
  }

  // Make request
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: requestBody,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new RestError(0, "Aborted", "Request was aborted", err as Error);
    }

    if (err instanceof TypeError) {
      throw new RestError(0, "Network Error", `Network error: ${err.message}`, err);
    }

    throw err;
  }

  // Handle non-2xx responses
  if (!response.ok) {
    let errorBody: string;
    try {
      errorBody = await response.text();
    } catch {
      errorBody = "(unable to read response body)";
    }

    // Special case: Davis CoPilot not available (403)
    if (response.status === 403 && path.includes("/davis/")) {
      throw new DavisCopilotUnavailableError();
    }

    // Rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const message = `Rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ""}`;
      throw new RestError(429, "Too Many Requests", message);
    }

    // Build meaningful error message
    let message = `API error ${response.status}`;
    try {
      const json = JSON.parse(errorBody);
      if (json.error) {
        message = json.error;
      } else if (json.message) {
        message = json.message;
      }
    } catch {
      // Not JSON, use body as-is (truncated)
      message = errorBody.slice(0, 200);
    }

    throw new RestError(response.status, response.statusText, message);
  }

  // Parse response
  let responseData: unknown;
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    try {
      const text = await response.text();
      responseData = text ? JSON.parse(text) : {};
    } catch (err) {
      throw new RestError(
        response.status,
        "Parse Error",
        `Failed to parse JSON response: ${err instanceof Error ? err.message : "Unknown error"}`,
        err instanceof Error ? err : undefined,
      );
    }
  } else {
    responseData = await response.text();
  }

  // Validate with schema if provided
  if (schema) {
    try {
      const validated = schema.parse(responseData);
      return {
        data: validated as T,
        status: response.status,
        headers: response.headers,
      };
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(err, `Response validation failed: ${err.message}`);
      }
      throw err;
    }
  }

  return {
    data: responseData as T,
    status: response.status,
    headers: response.headers,
  };
}

// ── Pagination Support ────────────────────────────────────────────────────────

export interface PaginationOptions<T> extends RestClientOptions<T> {
  paginate?: boolean;
  maxPages?: number;
  pageField?: "nextPageKey" | "pageToken" | "offset"; // nextPageKey is Dynatrace default
}

interface PaginatedResponse {
  nextPageKey?: string;
  pageToken?: string;
  offset?: number;
  [key: string]: unknown;
}

/**
 * Fetch all pages from a paginated API endpoint.
 * Automatically follows nextPageKey/pageToken/offset and concatenates results.
 *
 * @param tenant - Tenant configuration
 * @param path - API endpoint path
 * @param options - Request options with paginate: true
 * @returns Promise<RestResponse<T[]>>
 *
 * @example
 * const response = await dynatraceRest<Problem[]>(tenant, "/api/v2/problems", {
 *   paginate: true,
 *   maxPages: 5,
 * });
 * // Returns all pages concatenated into a single array
 */
export async function dynatraceRestPaginated<T = unknown>(
  tenant: TenantConfig,
  path: string,
  options: PaginationOptions<T> = {},
): Promise<RestResponse<unknown[]>> {
  const { paginate = true, maxPages = 10, pageField = "nextPageKey", ...restOptions } = options;

  if (!paginate) {
    const response = await dynatraceRest<T>(tenant, path, restOptions);
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data : [response.data],
    };
  }

  let allRecords: unknown[] = [];
  let pageKey: string | number | undefined;
  let pageCount = 0;
  let currentPath = path;

  while (pageCount < maxPages) {
    const response = await dynatraceRest<PaginatedResponse | unknown[]>(tenant, currentPath, restOptions as RestClientOptions<PaginatedResponse | unknown[]>);

    const responseData = response.data;

    // Extract records
    if (Array.isArray(responseData)) {
      allRecords = allRecords.concat(responseData);
    } else if (responseData && typeof responseData === "object") {
      // Flatten object to get records
      const obj = responseData as Record<string, unknown>;

      // Try common record field names
      const recordsField = ["results", "records", "data", "items"].find((field) => Array.isArray(obj[field]));
      if (recordsField) {
        allRecords = allRecords.concat(obj[recordsField] as unknown[]);
      } else {
        allRecords.push(responseData);
      }

      // Check for next page key
      pageKey = obj[pageField] as string | number | undefined;
      if (!pageKey) {
        break; // No more pages
      }

      // Build next request
      if (pageField === "nextPageKey") {
        currentPath = `${path}?pageKey=${encodeURIComponent(String(pageKey))}`;
      } else if (pageField === "offset") {
        const offset = typeof pageKey === "number" ? pageKey : parseInt(String(pageKey), 10);
        currentPath = `${path}?offset=${offset}`;
      } else {
        currentPath = `${path}?pageToken=${encodeURIComponent(String(pageKey))}`;
      }
    }

    pageCount++;

    if (!pageKey) {
      break; // No pagination field found
    }
  }

  return {
    data: allRecords,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
  };
}
