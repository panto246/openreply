// YKM fork addition: counts a tap on a campaign's follow-up link button, then
// redirects to the link the campaign currently has.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getRequestIp, hashClickIp, parseRecipientToken } from "@/lib/tracking/server";

type RouteProps = { params: Promise<{ automationId: string }> };

export async function GET(request: NextRequest, { params }: RouteProps) {
  const { automationId } = await params;
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    select: { instagramAccountId: true, followUpLinkUrl: true },
  });
  if (!automation?.followUpLinkUrl) {
    return NextResponse.redirect(new URL("/", request.url), { status: 302 });
  }

  try {
    await prisma.followUpClick.create({
      data: {
        automationId,
        instagramAccountId: automation.instagramAccountId,
        recipientHash: parseRecipientToken(request.nextUrl.searchParams.get("r")),
        ipHash: hashClickIp(getRequestIp(request)),
        userAgent: request.headers.get("user-agent"),
      },
    });
  } catch (error) {
    // Counting must never stop the visitor from reaching the page.
    console.log("[YKM] follow-up click not recorded:", (error as Error).message);
  }

  return NextResponse.redirect(automation.followUpLinkUrl, { status: 302 });
}
