// YKM fork addition: read-only content KPIs for the YKM panel's nightly job.
//   GET /api/ykm/content-kpi?days=30[&account=<username>]
//   Authorization: Bearer <YKM_KPI_SECRET>
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { PermissionError } from "@/lib/meta/client";
import {
  createInstagramContext,
  getAllUserMedia,
  getMediaInsights,
} from "@/lib/instagram/provider";
import {
  buildPost,
  groupDmStats,
  insightMetrics,
  type ContentKpiPost,
  type KeywordStats,
} from "@/lib/ykm/content-kpi";

export const maxDuration = 60;

const INSIGHTS_CONCURRENCY = 6;
// A post published within the window is at most this many posts back.
const MAX_MEDIA = 80;

function authorized(request: NextRequest) {
  const expected = process.env.YKM_KPI_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (expected.length < 24 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(params.get("days")) || 30, 1), 90);
  const onlyAccount = params.get("account")?.replace(/^@/, "").toLowerCase();
  const since = new Date(Date.now() - days * 86_400_000);

  const accounts = await prisma.instagramAccount.findMany({
    where: { provider: "META", accessToken: { not: "" } },
    select: {
      id: true,
      workspaceId: true,
      username: true,
      instagramId: true,
      accessToken: true,
      provider: true,
      zernioAccountId: true,
    },
  });
  const selected = onlyAccount
    ? accounts.filter((a) => a.username.toLowerCase() === onlyAccount)
    : accounts;

  const posts: ContentKpiPost[] = [];
  const keywords: KeywordStats[] = [];
  const warnings: string[] = [];

  for (const account of selected) {
    try {
      const context = await createInstagramContext(account);
      const media = (await getAllUserMedia({ context, max: MAX_MEDIA })).filter(
        (m) => new Date(m.timestamp) >= since
      );

      const insights = await mapWithConcurrency(media, INSIGHTS_CONCURRENCY, async (m) => {
        try {
          return await getMediaInsights({ context, mediaId: m.id, metrics: insightMetrics(m, true) });
        } catch (err) {
          if (err instanceof PermissionError) throw err;
          // `follows` is not offered for every media type; retry without it.
          try {
            return await getMediaInsights({ context, mediaId: m.id, metrics: insightMetrics(m, false) });
          } catch (retryErr) {
            if (retryErr instanceof PermissionError) throw retryErr;
            warnings.push(`${account.username} ${m.id}: ${(retryErr as Error).message}`);
            return null;
          }
        }
      });

      // DMs can arrive any time after the post, so read from the window start.
      const [automations, dms, clicks] = await Promise.all([
        prisma.automation.findMany({
          where: { instagramAccountId: account.id },
          select: { id: true, postId: true },
        }),
        prisma.dmLog.findMany({
          where: { instagramAccountId: account.id, createdAt: { gte: since } },
          select: { automationId: true, commenterId: true, status: true, matchedKeyword: true },
        }),
        prisma.linkClick.findMany({
          where: { instagramAccountId: account.id, createdAt: { gte: since } },
          select: { id: true, automationId: true, recipientHash: true, ipHash: true },
        }),
      ]);
      const postOf = new Map(automations.map((a) => [a.id, a.postId]));
      const stats = groupDmStats(dms, clicks, (id) => postOf.get(id));

      media.forEach((m, i) =>
        posts.push(buildPost(account.username, m, insights[i], stats.get(`m:${m.id}`)))
      );
      for (const [group, s] of stats) {
        if (group.startsWith("k:")) keywords.push({ account: account.username, keyword: group.slice(2), ...s });
      }
    } catch (err) {
      const reason =
        err instanceof PermissionError
          ? "insights permission missing — reconnect the account"
          : (err as Error).message;
      warnings.push(`${account.username}: ${reason}`);
    }
  }

  // Every selected account failing means the panel should raise an alert.
  const failed = selected.length === 0 || (posts.length === 0 && warnings.length > 0);
  return NextResponse.json(
    {
      success: !failed,
      generatedAt: new Date().toISOString(),
      days,
      accounts: selected.map((a) => a.username),
      posts,
      keywords,
      warnings,
      ...(selected.length === 0 ? { error: "No connected Instagram account matched" } : {}),
    },
    { status: failed ? 502 : 200 }
  );
}
