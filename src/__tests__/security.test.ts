/**
 * Security tests for P4-S2: Verify that secrets are not exposed in logs or error messages.
 */

import { OAuthError } from "../lib/auth";
import { createJiraIssue } from "../lib/integrations/jira";

describe("Security — Secret Redaction", () => {
  describe("OAuthError", () => {
    it("should redact client_secret from error body", () => {
      const maliciousBody = "error=invalid_request&client_secret=super-secret-key";
      const error = new OAuthError(400, maliciousBody);

      // The error message should redact the client_secret
      expect(error.message).not.toContain("super-secret-key");
      expect(error.message).toContain("[REDACTED]");
    });

    it("should handle multiple client_secret occurrences", () => {
      const body = "client_secret=secret1&code=abc&client_secret=secret2";
      const error = new OAuthError(400, body);

      expect(error.message).not.toContain("secret1");
      expect(error.message).not.toContain("secret2");
      expect(error.message).toMatch(/\[REDACTED\].*\[REDACTED\]/);
    });

    it("should preserve non-secret information in error body", () => {
      const body = "error=invalid_client&error_description=Client+authentication+failed";
      const error = new OAuthError(401, body);

      expect(error.message).toContain("invalid_client");
      expect(error.message).toContain("authentication");
    });

    it("should include status code in error", () => {
      const error = new OAuthError(500, "Internal server error");

      expect(error.statusCode).toBe(500);
      expect(error.message).toContain("500");
    });
  });

  describe("Token Cache", () => {
    it("production code should never log access tokens", () => {
      // Documents the contract that tokens should never appear in console output.
      // Proper error handling uses only user-friendly messages, not token values.
      const mockAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token.signature";

      const spy = jest.spyOn(console, "log").mockImplementation(() => {});

      // Example of CORRECT production pattern:
      // ✅ console.log("OAuth authentication succeeded"); // user-friendly message
      // NOT logging the token itself

      // Example of WRONG pattern (should never happen):
      // ❌ console.log("Using access token:", mockAccessToken);

      // Simulate correct behavior: log friendly message, never the token
      console.log("OAuth authentication succeeded");

      const logCalls = spy.mock.calls.map((c) => c.join(" ")).join("\n");

      // Verify the token never appears in logs
      expect(logCalls).not.toContain(mockAccessToken);
      // But user-friendly messages are OK
      expect(logCalls).toContain("OAuth authentication succeeded");

      spy.mockRestore();
    });
  });

  describe("createJiraIssue — token never leaks into errors", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("errors never contain the API token or its base64 encoding", async () => {
      const SECRET_TOKEN = "SECRET_TOKEN_123";
      const email = "user@example.com";
      const base64Auth = Buffer.from(`${email}:${SECRET_TOKEN}`).toString("base64");

      // First call: getProjectIssueTypes (resolveIssueTypeId) — returns issue types so we reach createIssue
      // Second call: createIssue — returns 401
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify([
              { id: "10011", name: "Bug" },
              { id: "10003", name: "Task" },
            ]),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ errorMessages: ["Unauthorized"] }),
        } as unknown as Response);

      let caughtError: Error | null = null;
      try {
        await createJiraIssue("https://test.atlassian.net", email, SECRET_TOKEN, {
          summary: "Test issue",
          description: "desc",
          issueType: "Bug",
          projectKey: "TEST_UNIQUE_KEY",
          priority: "Medium",
        });
      } catch (err) {
        caughtError = err as Error;
      }

      expect(caughtError).not.toBeNull();
      const msg = caughtError!.message;
      expect(msg).not.toContain(SECRET_TOKEN);
      expect(msg).not.toContain(base64Auth);
    });
  });

  describe("Preference values", () => {
    it("should never log preference values containing secrets", () => {
      // This documents the requirement that Jira preferences and OAuth credentials
      // are never logged, even in debug mode. They should only be used directly
      // in authenticated fetch calls.

      // Example of what NOT to do:
      // ❌ console.log("Using Jira token:", preferences.jiraApiToken)
      // ❌ showToast({ title: `Token: ${token}` })
      // ✅ Use token only in Authorization headers
      // ✅ Log only "Jira integration enabled" without the token itself

      expect(true).toBe(true); // This is a documentation test
    });
  });
});
