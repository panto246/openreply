import { prisma } from "@/lib/db/client";
import {
  createInstagramContext,
  hasInstagramCredentials,
  getUserMedia,
  type InstagramMedia,
} from "@/lib/instagram/provider";
import { matchKeywords } from "@/lib/utils/keyword-matcher";

function isReel(media: InstagramMedia): boolean {
  return media.media_product_type === "REELS";
}

/**
 * The caption text that carries the call to action. Captions say things like
 * "Yorumlara MEBİ yazın", so when the caption mentions comments we only look at
 * the words right after it; that keeps a keyword mentioned elsewhere in the
 * caption from binding the wrong campaign.
 */
function callToActionText(caption: string): string {
  const parts = caption.split(/yorum|comment/i).slice(1);
  return parts.length > 0 ? parts.map((p) => p.slice(0, 40)).join(" ") : caption;
}

/**
 * A campaign with keywords waits for the reel whose caption asks for one of
 * those keywords, so several pending campaigns each land on their own reel.
 * Any-word campaigns keep the original "earliest next reel" behaviour.
 */
function reelFitsCampaign(
  reel: InstagramMedia,
  automation: { keywords: string[]; matchAnyWord: boolean }
): boolean {
  if (automation.matchAnyWord || automation.keywords.length === 0) return true;
  const caption = reel.caption?.trim();
  if (!caption) return false;
  return matchKeywords(callToActionText(caption), automation.keywords, true).matched;
}

type KeywordSet = { keywords: string[]; matchAnyWord: boolean };

/** Two keyword campaigns compete for the same reel when a keyword of one matches the other. */
function keywordsOverlap(a: KeywordSet, b: KeywordSet): boolean {
  if (a.matchAnyWord || b.matchAnyWord) return false;
  if (a.keywords.length === 0 || b.keywords.length === 0) return false;
  return a.keywords.some((word) => matchKeywords(word, b.keywords, true).matched);
}

/**
 * YKM fork: pick the reel for one pending campaign. Several campaigns may share
 * a keyword (two "ATÖLYE" videos in a week); a reel already taken by a campaign
 * with an overlapping keyword is skipped, so the campaigns land on successive
 * reels in the order they were created.
 */
export function pickReelForCampaign(
  reels: InstagramMedia[],
  automation: KeywordSet & { createdAt: Date },
  claims: Map<string, KeywordSet[]>
): InstagramMedia | undefined {
  return reels.find(
    (reel) =>
      new Date(reel.timestamp) > automation.createdAt &&
      reelFitsCampaign(reel, automation) &&
      !(claims.get(reel.id) ?? []).some((other) => keywordsOverlap(automation, other))
  );
}

export type AttachNextReelResult = {
  checked: number;
  bound: number;
  failedAccounts: number;
};

/**
 * Bind each pending "next reel" campaign to the earliest reel published after
 * it was created. Kept outside the HTTP route so the long-running worker can
 * run the same check on every comment-poll interval.
 */
export async function attachPendingNextReels(): Promise<AttachNextReelResult> {
  const pending = await prisma.automation.findMany({
    where: { pendingNextReel: true },
    include: { instagramAccount: true },
  });

  // Group by connected account so we fetch each account's media only once.
  const byAccount = new Map<
    string,
    {
      account: (typeof pending)[number]["instagramAccount"];
      automations: typeof pending;
    }
  >();
  for (const automation of pending) {
    const key = automation.instagramAccountId;
    const entry = byAccount.get(key);
    if (entry) entry.automations.push(automation);
    else
      byAccount.set(key, {
        account: automation.instagramAccount,
        automations: [automation],
      });
  }

  let checked = 0;
  let bound = 0;
  const failures: string[] = [];

  for (const { account, automations } of byAccount.values()) {
    checked += automations.length;
    if (!account || !hasInstagramCredentials(account)) continue;

    let reels: InstagramMedia[];
    try {
      const context = await createInstagramContext(account);
      const media = await getUserMedia({ context, limit: 25 });
      reels = media
        .filter(isReel)
        .sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
    } catch (error) {
      failures.push(account.id);
      console.error("[attach-next-reel] media fetch failed", account.id, error);
      continue;
    }

    // Reels already bound to a campaign (from earlier runs) and the keywords of
    // the campaigns holding them.
    const claims = new Map<string, KeywordSet[]>();
    const alreadyBound = await prisma.automation.findMany({
      where: {
        instagramAccountId: account.id,
        postId: { in: reels.map((reel) => reel.id) },
      },
      select: { postId: true, keywords: true, matchAnyWord: true },
    });
    for (const bound of alreadyBound) {
      if (!bound.postId) continue;
      claims.set(bound.postId, [...(claims.get(bound.postId) ?? []), bound]);
    }

    // Oldest campaign first, so same-keyword campaigns take reels in order.
    const ordered = [...automations].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    for (const automation of ordered) {
      // The "next" reel = the earliest one posted after the campaign was created
      // whose caption asks for this campaign's keyword and that no other
      // campaign with the same keyword holds.
      const nextReel = pickReelForCampaign(reels, automation, claims);
      if (!nextReel) continue;
      claims.set(nextReel.id, [...(claims.get(nextReel.id) ?? []), automation]);

      await prisma.automation.update({
        where: { id: automation.id },
        data: {
          postId: nextReel.id,
          postUrl: nextReel.permalink ?? null,
          pendingNextReel: false,
        },
      });
      bound += 1;
    }
  }

  return { checked, bound, failedAccounts: failures.length };
}
