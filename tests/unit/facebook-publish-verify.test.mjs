/**
 * Facebook publish verification: require post id + GET confirmation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const {
  buildFacebookPostUrl,
  confirmFacebookPublish,
  FacebookPublishError,
  inspectFacebookPublishToken,
  requireGraphPostId,
  verifyFacebookPostExists,
} = await import("../../src/lib/facebook/verifyFacebookPost.ts");

describe("Facebook publish verification", () => {
  it("requireGraphPostId rejects HTTP-success bodies without id", () => {
    assert.throws(
      () => requireGraphPostId({}),
      (err) =>
        err instanceof FacebookPublishError && err.code === "MISSING_POST_ID",
    );
    assert.throws(
      () => requireGraphPostId({ success: true }),
      (err) =>
        err instanceof FacebookPublishError && err.code === "MISSING_POST_ID",
    );
    assert.equal(requireGraphPostId({ id: "123_456" }), "123_456");
    assert.equal(requireGraphPostId({ post_id: "789" }), "789");
  });

  it("buildFacebookPostUrl prefers composite Graph ids", () => {
    assert.equal(
      buildFacebookPostUrl("111_222"),
      "https://www.facebook.com/111_222",
    );
    assert.equal(
      buildFacebookPostUrl("999", "page-1"),
      "https://www.facebook.com/page-1/posts/999",
    );
  });

  it("inspectFacebookPublishToken surfaces scopes and expiry", () => {
    const health = inspectFacebookPublishToken({
      pageId: "page-1",
      pageAccessToken: "token",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      metadata: {
        requested_scopes: ["pages_show_list", "pages_manage_posts"],
        page_tasks: ["CREATE_CONTENT"],
      },
    });
    assert.equal(health.hasPagesManagePosts, true);
    assert.equal(health.isExpired, false);
    assert.ok(health.grantedScopes.includes("pages_manage_posts"));
  });

  it("inspectFacebookPublishToken flags expired tokens", () => {
    const health = inspectFacebookPublishToken({
      pageId: "page-1",
      pageAccessToken: "token",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      metadata: { page_tasks: ["CREATE_CONTENT"] },
    });
    assert.equal(health.isExpired, true);
  });

  it("verifyFacebookPostExists fails loudly when GET returns error", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({ error: { message: "Unsupported get request" } }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );

    await assert.rejects(
      () =>
        verifyFacebookPostExists({
          postId: "123_456",
          pageAccessToken: "tok",
          fetchImpl,
        }),
      (err) =>
        err instanceof FacebookPublishError &&
        err.code === "VERIFICATION_FAILED",
    );
  });

  it("confirmFacebookPublish returns verified post URL on success", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          id: "123_456",
          permalink_url: "https://www.facebook.com/123/posts/456",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const verified = await confirmFacebookPublish({
      graphResponse: { id: "123_456" },
      pageAccessToken: "tok",
      pageId: "123",
      fetchImpl,
    });

    assert.equal(verified.verified, true);
    assert.equal(verified.postId, "123_456");
    assert.equal(verified.postUrl, "https://www.facebook.com/123/posts/456");
  });

  it("confirmFacebookPublish refuses silent success without post id", async () => {
    await assert.rejects(
      () =>
        confirmFacebookPublish({
          graphResponse: { success: true },
          pageAccessToken: "tok",
          fetchImpl: async () => new Response("{}", { status: 200 }),
        }),
      (err) =>
        err instanceof FacebookPublishError && err.code === "MISSING_POST_ID",
    );
  });
});
