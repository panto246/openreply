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

    for (const automation of automations) {
      // The "next" reel = the earliest one posted after the campaign was created
      // whose caption asks for this campaign's keyword.
      const nextReel = reels.find(
        (reel) =>
          new Date(reel.timestamp) > automation.createdAt &&
          reelFitsCampaign(reel, automation)
      );
      if (!nextReel) continue;

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
