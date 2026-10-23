// YKM fork addition: per-post content KPIs for the YKM panel's nightly job.
// Kept in its own folder so upstream merges never touch it.
//
// DM numbers are attributed to a post in two ways:
//   * the campaign is tied to one post (automation.postId) → that post
//   * the campaign matches any post → grouped by the keyword the commenter used,
//     so the panel can pair it with the content's CTA word
// Link clicks follow the same grouping: a click carrying the recipient token (?r=)
// is traced back to that recipient's DM; older token-less clicks only count for
// single-post campaigns.
import { hashRecipientId } from "@/lib/tracking/server";
import type { InstagramMedia, InstagramMediaInsights } from "@/lib/meta/client";

export interface DmRow {
  automationId: string;
  commenterId: string;
  status: string;
  matchedKeyword: string | null;
}

export interface ClickRow {
  id: string;
  automationId: string;
  recipientHash: string | null;
  ipHash: string | null;
}

export interface DmStats {
  /** Unique people whose comment matched the campaign (DM flow started). */
  dmStarted: number;
  /** Unique people who actually received the DM. */
  dmSent: number;
  /** Unique people who tapped a tracked link in the DM. */
  linkClicks: number;
  /** Unique people who tapped the follow-up link button (the workshop link). */
  workshopClicks: number;
}

export interface ContentKpiPost extends Partial<DmStats> {
  account: string;
  mediaId: string;
  permalink: string | null;
  shortcode: string | null;
  publishedAt: string;
  mediaType: string;
  caption: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  follows: number | null;
}

export interface KeywordStats extends DmStats {
  account: string;
  keyword: string;
}

/** `https://www.instagram.com/reel/ABC123/?igsh=…` → `ABC123` (also /p/ and /tv/). */
export function shortcodeFromUrl(url: string | null | undefined) {
  if (!url) return null;
  const match =
    /instagram\.com\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/.exec(url);
  return match?.[1] ?? null;
}

export function normalizeKeyword(keyword: string) {
  return keyword.trim().toLocaleLowerCase("tr-TR");
}

export function isVideoLike(
  media: Pick<InstagramMedia, "media_type" | "media_product_type">,
) {
  return media.media_product_type === "REELS" || media.media_type === "VIDEO";
}

export function insightMetrics(
  media: Pick<InstagramMedia, "media_type" | "media_product_type">,
  withFollows: boolean,
) {
  const metrics = isVideoLike(media)
    ? ["views", "reach", "saved", "shares"]
    : ["reach", "saved", "shares"];
  return withFollows ? [...metrics, "follows"] : metrics;
}

const STARTED_EXCLUDED = new Set(["SKIPPED_NO_MATCH"]);

/**
 * Groups DM logs and link clicks per post (`m:<mediaId>`) or per keyword
 * (`k:<keyword>`). `postIdOf` returns the automation's post, or null for
 * any-post campaigns.
 */
export function groupDmStats(
  dms: DmRow[],
  clicks: ClickRow[],
  postIdOf: (automationId: string) => string | null | undefined,
  followUpClicks: ClickRow[] = [],
) {
  const started = new Map<string, Set<string>>();
  const sent = new Map<string, Set<string>>();
  const clickers = new Map<string, Set<string>>();
  const workshopClickers = new Map<string, Set<string>>();
  const groupByRecipient = new Map<string, string>();

  const add = (map: Map<string, Set<string>>, group: string, who: string) => {
    const set = map.get(group) ?? new Set<string>();
    set.add(who);
    map.set(group, set);
  };

  for (const dm of dms) {
    const postId = postIdOf(dm.automationId);
    const group = postId
      ? `m:${postId}`
      : dm.matchedKeyword
        ? `k:${normalizeKeyword(dm.matchedKeyword)}`
        : null;
    if (!group) continue;
    groupByRecipient.set(
      `${dm.automationId}:${hashRecipientId(dm.commenterId)}`,
      group,
    );
    if (!STARTED_EXCLUDED.has(dm.status)) add(started, group, dm.commenterId);
    if (dm.status === "SENT") add(sent, group, dm.commenterId);
  }

  const countClicks = (rows: ClickRow[], into: Map<string, Set<string>>) => {
    for (const click of rows) {
      const traced = click.recipientHash
        ? groupByRecipient.get(`${click.automationId}:${click.recipientHash}`)
        : undefined;
      const postId = postIdOf(click.automationId);
      const group = traced ?? (postId ? `m:${postId}` : null);
      if (!group) continue;
      const visitor = click.recipientHash
        ? `r:${click.recipientHash}`
        : click.ipHash
          ? `ip:${click.ipHash}`
          : `click:${click.id}`;
      add(into, group, visitor);
    }
  };
  countClicks(clicks, clickers);
  countClicks(followUpClicks, workshopClickers);

  const groups = new Set([
    ...started.keys(),
    ...sent.keys(),
    ...clickers.keys(),
    ...workshopClickers.keys(),
  ]);
  return new Map<string, DmStats>(
    [...groups].map((group) => [
      group,
      {
        dmStarted: started.get(group)?.size ?? 0,
        dmSent: sent.get(group)?.size ?? 0,
        linkClicks: clickers.get(group)?.size ?? 0,
        workshopClicks: workshopClickers.get(group)?.size ?? 0,
      },
    ]),
  );
}

export function buildPost(
  account: string,
  media: InstagramMedia,
  insights: (InstagramMediaInsights & { follows?: number }) | null,
  dm: DmStats | undefined,
): ContentKpiPost {
  return {
    account,
    mediaId: media.id,
    permalink: media.permalink ?? null,
    shortcode: shortcodeFromUrl(media.permalink),
    publishedAt: media.timestamp,
    mediaType: media.media_product_type ?? media.media_type,
    // Full caption: the panel matches the "yorumlara X yazın" call to action,
    // which usually sits at the end.
    caption: media.caption?.trim() || null,
    views: insights?.views ?? null,
    reach: insights?.reach ?? null,
    likes: media.like_count ?? null,
    comments: media.comments_count ?? null,
    saved: insights?.saved ?? null,
    shares: insights?.shares ?? null,
    follows: insights?.follows ?? null,
    ...dm,
  };
}
