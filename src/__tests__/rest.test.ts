// src/__tests__/rest.test.ts
// Unit tests for REST API client

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { z } from "zod";
import {
  dynatraceRest,
  dynatraceRestPaginated,
  registerMock,
  clearMocks,
  RestError,
  ValidationError,
  DavisCopilotUnavailableError,
} from "../lib/api/rest";
import { TenantConfig } from "../lib/auth";

// Mock dependencies
jest.mock("../lib/auth");
jest.mock("../lib/devMode");

// Sample schema for testing
const sampleSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number().optional(),
});

type Sample = z.infer<typeof sampleSchema>;

const mockTenant: TenantConfig = {
  id: "test-tenant",
  name: "Test Tenant",
  tenantEndpoint: "https://test.live.dynatrace.com",
  clientId: "test-client",
  clientSecret: "test-secret",
  ssoEndpoint: "https://sso.dynatrace.com/sso/oauth2/token",
  scopes: ["test:scope"],
};

describe("dynatraceRest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMocks();
  });

  it("should make a GET request without body", async () => {
    const mockResponse = { id: "123", name: "Test" };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      } as Response),
    );

    const result = await dynatraceRest<typeof mockResponse>(mockTenant, "/api/v2/test", {
      method: "GET",
    });

    expect(result.status).toBe(200);
    expect(result.data).toEqual(mockResponse);
  });

  it("should validate response with Zod schema", async () => {
    const mockData: Sample = { id: "123", name: "Test", value: 42 };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify(mockData)),
      } as Response),
    );

    const result = await dynatraceRest<Sample>(mockTenant, "/api/v2/test", {
      schema: sampleSchema,
    });

    expect(result.data).toEqual(mockData);
  });

  it("should throw ValidationError on schema mismatch", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify({ id: "123" })), // Missing required 'name'
      } as Response),
    );

    await expect(
      dynatraceRest<Sample>(mockTenant, "/api/v2/test", {
        schema: sampleSchema,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("should handle HTTP 403 for Davis CoPilot as special error", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
        text: () => Promise.resolve("{}"),
      } as Response),
    );

    await expect(dynatraceRest(mockTenant, "/davis/v1/copilot/nl2dql", { method: "POST" })).rejects.toThrow(
      DavisCopilotUnavailableError,
    );
  });

  it("should handle 429 rate limit error", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({ "retry-after": "60" }),
        text: () => Promise.resolve("Rate limited"),
      } as Response),
    );

    await expect(dynatraceRest(mockTenant, "/api/v2/test")).rejects.toThrow(
      expect.objectContaining({
        statusCode: 429,
      }),
    );
  });

  it("should support query parameters", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify([])),
      } as Response),
    );

    await dynatraceRest(mockTenant, "/api/v2/slo", {
      queryParams: { limit: "50", offset: "0" },
    });

    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toContain("limit=50");
    expect(call[0]).toContain("offset=0");
  });

  it("should support POST with body", async () => {
    const requestBody = { title: "New Event", severity: "CRITICAL" };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 201,
        statusText: "Created",
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify({ id: "event-123" })),
      } as Response),
    );

    await dynatraceRest(mockTenant, "/api/v2/events", {
      method: "POST",
      body: requestBody,
    });

    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[1].method).toBe("POST");
    expect(call[1].body).toBe(JSON.stringify(requestBody));
  });

  it("should handle network errors gracefully", async () => {
    global.fetch = jest.fn(() => Promise.reject(new TypeError("Network error")));

    await expect(dynatraceRest(mockTenant, "/api/v2/test")).rejects.toThrow(RestError);
  });

  it("should handle AbortSignal", async () => {
    const controller = new AbortController();

    global.fetch = jest.fn(() => Promise.reject(new DOMException("Aborted", "AbortError")));

    await expect(dynatraceRest(mockTenant, "/api/v2/test", { signal: controller.signal })).rejects.toThrow(RestError);
  });
});

describe("dynatraceRestPaginated", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should concatenate paginated results", async () => {
    const page1 = [
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ];
    const page2 = [{ id: "3", name: "Item 3" }];

    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      const response = callCount === 1 ? page1 : page2;
      const pageKey = callCount === 1 ? "page2Key" : undefined;

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        text: () =>
          Promise.resolve(
            JSON.stringify({
              results: response,
              nextPageKey: pageKey,
            }),
          ),
      } as Response);
    });

    const result = await dynatraceRestPaginated(mockTenant, "/api/v2/problems", {
      paginate: true,
    });

    expect(result.data).toHaveLength(3);
    expect(result.data).toEqual([...page1, ...page2]);
  });

  it("should respect maxPages limit", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        text: () =>
          Promise.resolve(
            JSON.stringify({
              results: [{ id: String(callCount) }],
              nextPageKey: callCount < 10 ? `page${callCount + 1}` : undefined,
            }),
          ),
      } as Response);
    });

    await dynatraceRestPaginated(mockTenant, "/api/v2/test", {
      paginate: true,
      maxPages: 3,
    });

    // Should stop at maxPages
    expect(callCount).toBeLessThanOrEqual(3);
  });

  it("should handle arrays directly", async () => {
    const items = [
      { id: "1", name: "Test 1" },
      { id: "2", name: "Test 2" },
    ];

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify(items)),
      } as Response),
    );

    const result = await dynatraceRestPaginated(mockTenant, "/api/v2/test");

    expect(result.data).toEqual(items);
  });
});

describe("Mock mode", () => {
  beforeEach(() => {
    clearMocks();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isMockMode } = require("../lib/devMode");
    isMockMode.mockReturnValue(true);
  });

  it("should return mock data when registered", async () => {
    const mockData = { id: "mock-123", name: "Mock Item" };
    registerMock("/api/v2/test", mockData);

    const result = await dynatraceRest(mockTenant, "/api/v2/test");

    expect(result.data).toEqual(mockData);
    expect(result.status).toBe(200);
  });

  it("should return empty response when no mock found", async () => {
    clearMocks();

    const result = await dynatraceRest(mockTenant, "/api/v2/unknown");

    expect(result.data).toEqual([]);
    expect(result.status).toBe(200);
  });

  it("should match mock paths with includes", async () => {
    const mockData = { result: "found" };
    registerMock("/api/v2", mockData);

    const result = await dynatraceRest(mockTenant, "/api/v2/slo/list");

    expect(result.data).toEqual(mockData);
  });
});
