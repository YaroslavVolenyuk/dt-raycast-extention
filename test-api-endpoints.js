#!/usr/bin/env node

/**
 * API Endpoint Tester for Dynatrace Workflows
 *
 * Usage:
 *   node test-api-endpoints.js <tenantUrl> <workflowId> <accessToken>
 *
 * Example:
 *   node test-api-endpoints.js "https://abc12345.live.dynatrace.com" "55247bef-1a0d-4fda-ba07-b9557ea52858" "your-token-here"
 */

const endpoints = [
  "/platform/automation/v1/workflows/{id}/executions",
  "/api/v2/workflows/{id}/executions",
  "/api/v2/automation/workflows/{id}/executions",
  "/api/v2/automations/{id}/executions",
  "/api/v2/automations/workflows/{id}/executions",
  "/platform/automation/v1/workflows/{id}/runs",
  "/api/v2/workflows/{id}/runs",
  "/api/v2/workflows/{id}/history",
  "/api/v2/workflows/{id}/tasks",
  "/platform/automation/v1/workflows/{id}",
  "/api/v2/workflows/{id}",
  "/api/v2/automations/{id}",
];

async function testEndpoint(baseUrl, endpoint, token) {
  const url = baseUrl + endpoint;
  console.log(`\n📡 Testing: ${endpoint}`);
  console.log(`   Full URL: ${url}`);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ SUCCESS!`);
      console.log(`   Response type: ${Array.isArray(data) ? "Array" : typeof data}`);
      console.log(`   Sample: ${JSON.stringify(data).substring(0, 200)}...`);
      return { success: true, endpoint, status: response.status, data };
    } else {
      const body = await response.text();
      console.log(`   ❌ FAILED`);
      console.log(`   Error: ${body.substring(0, 200)}`);
      return { success: false, endpoint, status: response.status };
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return { success: false, endpoint, error: error.message };
  }
}

async function main() {
  const [tenantUrl, workflowId, accessToken] = process.argv.slice(2);

  if (!tenantUrl || !workflowId || !accessToken) {
    console.error("Usage: node test-api-endpoints.js <tenantUrl> <workflowId> <accessToken>");
    console.error("\nExample:");
    console.error('  node test-api-endpoints.js "https://abc12345.live.dynatrace.com" "55247bef-1a0d-4fda-ba07-b9557ea52858" "dt0c01.st..."');
    process.exit(1);
  }

  console.log("🔍 Dynatrace Workflow Executions API Endpoint Tester");
  console.log(`Tenant: ${tenantUrl}`);
  console.log(`Workflow ID: ${workflowId}`);
  console.log(`Access Token: ${accessToken.substring(0, 20)}...`);
  console.log(`Total endpoints to test: ${endpoints.length}`);

  const results = [];
  for (const endpoint of endpoints) {
    const fullEndpoint = endpoint.replace("{id}", workflowId);
    const result = await testEndpoint(tenantUrl, fullEndpoint, accessToken);
    results.push(result);

    // Add a small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n" + "=".repeat(80));
  console.log("📊 SUMMARY");
  console.log("=".repeat(80));

  const successful = results.filter((r) => r.success);
  if (successful.length > 0) {
    console.log("\n✅ WORKING ENDPOINTS:");
    successful.forEach((r) => {
      console.log(`   ${r.endpoint}`);
    });
  } else {
    console.log("\n❌ NO WORKING ENDPOINTS FOUND");
    console.log("\nPossible causes:");
    console.log("  1. Invalid access token");
    console.log("  2. Workflow ID doesn't exist");
    console.log("  3. Tenant URL is incorrect");
    console.log("  4. API endpoints are completely different");
    console.log("\nNext steps:");
    console.log("  - Check Dynatrace API documentation");
    console.log("  - Verify access token is valid");
    console.log("  - Verify workflow ID exists in Dynatrace");
  }
}

main();
