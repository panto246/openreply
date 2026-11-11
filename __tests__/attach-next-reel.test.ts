import { describe, expect, it } from "vitest";
import { pickReelForCampaign } from "@/lib/automation/attach-next-reel";
import type { InstagramMedia } from "@/lib/instagram/provider";

function reel(id: string, timestamp: string, caption: string): InstagramMedia {
  return { id, timestamp, caption, media_product_type: "REELS" } as InstagramMedia;
}

const campaign = (createdAt: string, keywords: string[]) => ({
  createdAt: new Date(createdAt),
  keywords,
  matchAnyWord: false,
});

describe("pickReelForCampaign", () => {
  const reels = [
    reel("r1", "2026-11-12T14:30:00Z", "Alex'in kulesi. Yorumlara ATÖLYE yazın"),
    reel("r2", "2026-11-14T14:30:00Z", "%1 ile %10 farkı. Yorumlara atölye yaz"),
  ];

  it("binds two same-keyword campaigns to successive reels", () => {
    const claims = new Map();
    const first = campaign("2026-11-10T10:00:00Z", ["ATÖLYE"]);
    const second = campaign("2026-11-10T10:05:00Z", ["ATÖLYE"]);

    const a = pickReelForCampaign(reels, first, claims);
    expect(a?.id).toBe("r1");
    claims.set(a!.id, [first]);

    expect(pickReelForCampaign(reels, second, claims)?.id).toBe("r2");
  });

  it("skips a reel already bound in an earlier run", () => {
    const claims = new Map([["r1", [{ keywords: ["atölye"], matchAnyWord: false }]]]);
    expect(pickReelForCampaign(reels, campaign("2026-11-10T10:05:00Z", ["ATÖLYE"]), claims)?.id).toBe("r2");
  });

  it("waits when the only matching reel is taken", () => {
    const claims = new Map([
      ["r1", [{ keywords: ["ATÖLYE"], matchAnyWord: false }]],
      ["r2", [{ keywords: ["ATÖLYE"], matchAnyWord: false }]],
    ]);
    expect(pickReelForCampaign(reels, campaign("2026-11-10T10:05:00Z", ["ATÖLYE"]), claims)).toBeUndefined();
  });

  it("does not block a campaign with a different keyword", () => {
    const own = [reel("r3", "2026-11-12T14:30:00Z", "Yorumlara TAHMİN yazın")];
    const claims = new Map([["r3", [{ keywords: ["ATÖLYE"], matchAnyWord: false }]]]);
    expect(pickReelForCampaign(own, campaign("2026-11-10T10:00:00Z", ["TAHMİN"]), claims)?.id).toBe("r3");
  });

  it("ignores reels posted before the campaign was created", () => {
    expect(pickReelForCampaign(reels, campaign("2026-11-13T00:00:00Z", ["ATÖLYE"]), new Map())?.id).toBe("r2");
  });
});
