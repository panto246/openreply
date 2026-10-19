import { describe, expect, it } from "vitest";
import { hashRecipientId } from "../lib/tracking/server";
import {
  buildPost,
  groupDmStats,
  insightMetrics,
  shortcodeFromUrl,
} from "../lib/ykm/content-kpi";

describe("ykm content kpi", () => {
  it("extracts the shortcode from reel, post and profile-scoped links", () => {
    expect(shortcodeFromUrl("https://www.instagram.com/reel/DAbc_12-x/?igsh=xyz")).toBe("DAbc_12-x");
    expect(shortcodeFromUrl("https://instagram.com/p/C9zz/")).toBe("C9zz");
    expect(shortcodeFromUrl("https://www.instagram.com/ykm/reels/QQ1/")).toBe("QQ1");
    expect(shortcodeFromUrl("https://example.com/reel/x")).toBeNull();
    expect(shortcodeFromUrl(null)).toBeNull();
  });

  it("asks views only for video-like media", () => {
    expect(insightMetrics({ media_type: "VIDEO", media_product_type: "REELS" }, true)).toEqual([
      "views", "reach", "saved", "shares", "follows",
    ]);
    expect(insightMetrics({ media_type: "CAROUSEL_ALBUM" }, false)).toEqual(["reach", "saved", "shares"]);
  });

  it("counts unique people per post and per keyword", () => {
    const postOf = (id: string) => ({ a1: "M1", a2: null } as Record<string, string | null>)[id];
    const stats = groupDmStats(
      [
        { automationId: "a1", commenterId: "u1", status: "SENT", matchedKeyword: "kat" },
        { automationId: "a1", commenterId: "u1", status: "SKIPPED_DEDUP", matchedKeyword: "kat" },
        { automationId: "a1", commenterId: "u2", status: "FAILED", matchedKeyword: "kat" },
        { automationId: "a1", commenterId: "u3", status: "SKIPPED_NO_MATCH", matchedKeyword: null },
        { automationId: "a2", commenterId: "u4", status: "SENT", matchedKeyword: " KAT " },
        { automationId: "a2", commenterId: "u5", status: "SENT", matchedKeyword: null },
      ],
      [
        { id: "c1", automationId: "a1", recipientHash: hashRecipientId("u1"), ipHash: null },
        { id: "c2", automationId: "a1", recipientHash: hashRecipientId("u1"), ipHash: "ip" },
        { id: "c3", automationId: "a1", recipientHash: null, ipHash: "ip9" },
        { id: "c4", automationId: "a2", recipientHash: hashRecipientId("u4"), ipHash: null },
        { id: "c5", automationId: "a2", recipientHash: null, ipHash: "ip8" },
      ],
      postOf
    );

    expect(stats.get("m:M1")).toEqual({ dmStarted: 2, dmSent: 1, linkClicks: 2 });
    expect(stats.get("k:kat")).toEqual({ dmStarted: 1, dmSent: 1, linkClicks: 1 });
    expect(stats.size).toBe(2);
  });

  it("keeps missing insights as null instead of zero", () => {
    const post = buildPost(
      "ykm",
      { id: "M1", media_type: "IMAGE", timestamp: "2026-10-10T10:00:00+0000", permalink: "https://www.instagram.com/p/AB/" },
      null,
      undefined
    );
    expect(post).toMatchObject({ shortcode: "AB", views: null, reach: null, likes: null, follows: null });
    expect(post.dmStarted).toBeUndefined();
  });
});
