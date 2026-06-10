#!/usr/bin/env node

/**
 * SLO Endpoint Tester for Dynatrace
 *
 * Usage:
 *   node test-slo-endpoints.js <tenantUrl> <accessToken>
 *
 * Example:
 *   node test-slo-endpoints.js "https://abc12345.live.dynatrace.com" "dt0c01.st..."
 *
 * This script tests all SLO-related endpoints to verify:
 * - Token is valid
 * - Required OAuth scopes are granted
 */

const endpoints = [
  {
    method: "GET",
    path: "/api/v2/slo",
    description: "List all SLOs",
    requiredScopes: ["slo:slos:read"],
  },
  {
    method: "GET",
    path: "/api/v2/slo/objective-templates",
    description: "List SLO objective templates",
    requiredScopes: ["slo:objective-templates:read"],
  },
  {
    method: "GET",
    path: "/api/environment/v2/slo",
    description: "Environment API - List SLOs",
    requiredScopes: ["environment-api:slo:read"],
  },
  {
    method: "GET",
    path: "/api/v2/metrics",
    description: "List metrics (for SLO metric selection)",
    requiredScopes: ["storage:metrics:read"],
  },
];

async function testEndpoint(baseUrl, endpoint, token) {
  const url = baseUrl + endpoint.path;
  console.log(`\n📡 Testing: ${endpoint.description}`);
  console.log(`   Method: ${endpoint.method}`);
  console.log(`   Path: ${endpoint.path}`);
  console.log(`   Required scopes: ${endpoint.requiredScopes.join(", ")}`);
  console.log(`   Full URL: ${url.substring(0, 100)}...`);

  try {
    const response = await fetch(url, {
      method: endpoint.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ SUCCESS!`);
      console.log(`   Response type: ${Array.isArray(data) ? `Array (${data.length} items)` : typeof data}`);
      if (Array.isArray(data) && data.length > 0) {
        console.log(`   First item: ${JSON.stringify(data[0]).substring(0, 150)}...`);
      }
      return { success: true, path: endpoint.path, status: response.status, scopes: endpoint.requiredScopes };
    } else {
      const body = await response.text();
      console.log(`   ❌ FAILED`);

      // Try to parse error response
      try {
        const json = JSON.parse(body);
        if (json.error) {
          console.log(`   Error: ${typeof json.error === "string" ? json.error : JSON.stringify(json.error)}`);
        } else if (json.message) {
          console.log(`   Message: ${json.message}`);
        } else {
          console.log(`   Response: ${JSON.stringify(json).substring(0, 200)}`);
        }
      } catch {
        console.log(`   Response: ${body.substring(0, 200)}`);
      }

      return { success: false, path: endpoint.path, status: response.status, scopes: endpoint.requiredScopes };
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return { success: false, path: endpoint.path, error: error.message, scopes: endpoint.requiredScopes };
  }
}

async function main() {
  const [tenantUrl, accessToken] = process.argv.slice(2);

  if (!tenantUrl || !accessToken) {
    console.error("Usage: node test-slo-endpoints.js <tenantUrl> <accessToken>");
    console.error("\nExample:");
    console.error('  node test-slo-endpoints.js "https://abc12345.live.dynatrace.com" "dt0c01.st..."');
    console.error("\nYou can get an access token from your Dynatrace Environment > Access Tokens");
    process.exit(1);
  }

  // Normalize tenant URL (remove trailing slash)
  const normalizedUrl = tenantUrl.replace(/\/$/, "");

  console.log("🔍 Dynatrace SLO Endpoint Tester");
  console.log("================================");
  console.log(`Tenant: ${normalizedUrl}`);
  console.log(`Access Token: ${accessToken.substring(0, 20)}...`);
  console.log(`Total endpoints to test: ${endpoints.length}`);
  console.log("\nTesting endpoints...");

  const results = [];
  for (const endpoint of endpoints) {
    const result = await testEndpoint(normalizedUrl, endpoint, accessToken);
    results.push(result);

    // Add a small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 SUMMARY");
  console.log("=".repeat(80));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (successful.length > 0) {
    console.log(`\n✅ WORKING ENDPOINTS (${successful.length}/${results.length}):`);
    successful.forEach((r) => {
      console.log(`   ${r.path}`);
      console.log(`      Scopes: ${r.scopes.join(", ")}`);
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ FAILED ENDPOINTS (${failed.length}/${results.length}):`);
    failed.forEach((r) => {
      console.log(`   ${r.path}`);
      console.log(`      Status: ${r.status || "Network Error"}`);
      console.log(`      Required scopes: ${r.scopes.join(", ")}`);
    });

    console.log("\n🔐 PERMISSION ISSUES?");
    console.log("Your token is missing required OAuth scopes. Here's what to do:");
    console.log("1. Go to your Dynatrace Environment");
    console.log("2. Navigate to Access Tokens");
    console.log("3. Create or edit a token with these scopes:");

    const allRequiredScopes = new Set();
    failed.forEach((r) => {
      r.scopes.forEach((scope) => allRequiredScopes.add(scope));
    });

    Array.from(allRequiredScopes).forEach((scope) => {
      console.log(`   - ${scope}`);
    });
  }

  if (successful.length === results.length) {
    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("Your token has all required scopes for SLO operations.");
  }
}

main();
