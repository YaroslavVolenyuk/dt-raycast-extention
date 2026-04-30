// src/__tests__/davis.test.ts
// Unit tests for Davis CoPilot API client

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { convertNl2Dql, explainDql, askDavis } from "../lib/api/davis";
import { TenantConfig } from "../lib/auth";

// Mock dependencies
jest.mock("../lib/api/rest");
jest.mock("../lib/devMode");

const mockTenant: TenantConfig = {
  id: "test-tenant",
  name: "Test Tenant",
  tenantEndpoint: "https://test.live.dynatrace.com",
  clientId: "test-client",
  clientSecret: "test-secret",
  ssoEndpoint: "https://sso.dynatrace.com/sso/oauth2/token",
  scopes: ["davis:api:read"],
};

describe("Davis CoPilot API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("convertNl2Dql", () => {
    it("should return mock DQL for common natural language queries in mock mode", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const result = await convertNl2Dql(
        mockTenant,
        "error logs from payment service last hour",
      );

      expect(result).toContain("fetch logs");
      expect(result).toContain("payment-service");
      expect(result).toContain("ERROR");
    });

    it("should handle unknown queries in mock mode with fallback", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const result = await convertNl2Dql(mockTenant, "some random query");

      expect(result).toContain("fetch logs");
      expect(result).toContain("some random query");
    });

    it("should return DQL for kubernetes queries", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const result = await convertNl2Dql(
        mockTenant,
        "what is the cpu usage of my kubernetes cluster",
      );

      expect(result).toContain("kubernetes");
    });
  });

  describe("explainDql", () => {
    it("should return explanation for common DQL queries in mock mode", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const dql = 'fetch logs, filter by dt.entity.service_name == "payment-service"';
      const result = await explainDql(mockTenant, dql);

      expect(result).toContain("log");
      expect(result.length).toBeGreaterThan(20);
    });

    it("should provide default explanation in mock mode for unknown queries", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const dql = "fetch unknown_table | filter foo == bar";
      const result = await explainDql(mockTenant, dql);

      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(10);
    });

    it("should explain complex DQL queries", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const dql = "fetch dt.davis.problems, filter by severity == \"CRITICAL\" | stats count()";
      const result = await explainDql(mockTenant, dql);

      expect(result).toContain("count");
    });
  });

  describe("askDavis", () => {
    it("should return answer with sources for service issues", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const result = await askDavis(mockTenant, "what's wrong with order-service");

      expect(result.answer).toBeTruthy();
      expect(result.answer).toContain("order-service");
      expect(result.sources).toBeDefined();
      expect(result.sources?.length).toBeGreaterThan(0);
    });

    it("should return answer for performance questions", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const result = await askDavis(mockTenant, "are we having performance issues");

      expect(result.answer).toBeTruthy();
      expect(result.answer.length).toBeGreaterThan(50);
    });

    it("should return answer for deployment queries", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const result = await askDavis(mockTenant, "show latest deployments");

      expect(result.answer).toBeTruthy();
      expect(result.answer).toContain("deployment");
    });

    it("should support conversation history", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const history = [
        { role: "user" as const, content: "what's the issue" },
        { role: "assistant" as const, content: "There's a latency issue" },
      ];

      const result = await askDavis(mockTenant, "is it critical", undefined, history);

      expect(result.answer).toBeTruthy();
    });

    it("should support entity context", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const context = {
        entityName: "payment-service",
        entityType: "SERVICE",
        entityId: "SERVICE-payment-service",
      };

      const result = await askDavis(mockTenant, "how is this service performing", context);

      expect(result.answer).toBeTruthy();
    });

    it("should return sources with relevant information", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const result = await askDavis(mockTenant, "what's wrong with order-service");

      expect(result.sources).toBeDefined();
      result.sources?.forEach((source) => {
        expect(source.title).toBeTruthy();
        expect(source.type).toMatch(/PROBLEM|TRACE|LOG|METRIC|ENTITY/);
      });
    });

    it("should provide fallback answer for unknown questions", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const result = await askDavis(mockTenant, "unknown obscure question xyz");

      expect(result.answer).toBeTruthy();
      expect(result.answer).toContain("unknown obscure question xyz");
    });

    it("should handle error budget status questions", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const result = await askDavis(mockTenant, "what is my error budget status");

      expect(result.answer).toBeTruthy();
      expect(result.answer).toContain("SLO");
    });

    it("should handle latency trend questions", async () => {
      const { isMockMode } = require("../lib/devMode");
      isMockMode.mockReturnValue(true);

      const result = await askDavis(mockTenant, "check latency trends");

      expect(result.answer).toBeTruthy();
      expect(result.answer).toContain("latency");
    });
  });
});
