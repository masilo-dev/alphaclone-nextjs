const { test, expect } = require("@playwright/test");

test.describe("MCP ChatGPT OAuth", () => {
  test("Authorize page requires login for ChatGPT connector", async ({
    page,
  }) => {
    const params = new URLSearchParams({
      client_id: "chatgpt-connector",
      redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
      response_type: "code",
      state: "test-state",
      code_challenge: "test-challenge",
      code_challenge_method: "S256",
      scope: "read write",
    });

    await page.goto(`/authorize?${params.toString()}`);
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test("OAuth approve rejects unauthenticated requests", async ({
    request,
  }) => {
    const res = await request.post("/api/mcp/oauth/approve", {
      data: {
        client_id: "chatgpt-connector",
        redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
        scope: "read write",
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("MCP tools endpoint rejects missing auth", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.text();
    expect(body.toLowerCase()).toMatch(/auth|token|unauthorized/);
  });

  test("MCP well-known discovery is public", async ({ request }) => {
    const res = await request.get(
      "/api/mcp/well-known/oauth-authorization-server",
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorization_endpoint || body.issuer).toBeTruthy();
  });
});
