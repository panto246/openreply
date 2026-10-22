import { prisma } from "@/lib/db/client";

/**
 * One-off YKM switch, run when the worker boots on this code.
 *
 * While Railway builds were paused (22 Oct 2026) the 1st-week lead magnet
 * campaigns ran on a temporary setup the old worker understood: any-post
 * matching and the workshop link inline in the follow-up text. This worker can
 * bind each campaign to its own reel (by caption keyword) and send the link as
 * a button, so it moves them to the final setup. Idempotent: a campaign already
 * on its final setup, or already bound to a post, is left alone.
 */
const CAMPAIGN_IDS = [
  "cmvj2qhox000008l5wljob4h1", // lm-mebi
  "cmvj2qir8000208l5fhkyzqfo", // lm-kat
  "cmvj2qk55000408l50m0pj4pr", // lm-hata
  "cmvj2ql9o000608l5cl9f7wr0", // lm-kaynak
  "cmvj2qmcj000808l53cd6s2wa", // lm-uslu
];
const ACCOUNT = "yasinkurt.matematik";
const BUTTON_LABEL = "Yerimi ayırt";
const URL_PATTERN = /\s*(https?:\/\/\S+)\s*$/;

export async function switchYkmCampaigns(): Promise<number> {
  const campaigns = await prisma.automation.findMany({
    where: { id: { in: CAMPAIGN_IDS }, instagramAccount: { username: ACCOUNT } },
  });

  let changed = 0;
  for (const c of campaigns) {
    const data: Record<string, unknown> = {};

    // Any-post campaign not yet bound: wait for the reel whose caption asks for it.
    if (c.matchAnyPost && !c.postId) {
      data.matchAnyPost = false;
      data.pendingNextReel = true;
    }

    // Workshop link at the end of the follow-up text: move it to a button.
    const link = c.followUpLinkUrl ? null : URL_PATTERN.exec(c.followUpMessage ?? "");
    if (link) {
      data.followUpLinkUrl = link[1];
      data.followUpButtonLabel = BUTTON_LABEL;
      data.followUpMessage = (c.followUpMessage ?? "")
        .replace(URL_PATTERN, "")
        .replace("aşağıdaki bağlantıya tıklayın", "aşağıdaki butona dokunun")
        .trim();
    }

    if (Object.keys(data).length === 0) continue;
    await prisma.automation.update({ where: { id: c.id }, data });
    changed += 1;
  }
  return changed;
}
