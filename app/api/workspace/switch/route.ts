// YKM fork addition: switch the active company (workspace). Only a workspace
// the signed-in user is a member of can be chosen.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/ykm/active-workspace";

const schema = z.object({ workspaceId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId: parsed.data.workspaceId },
    select: { workspaceId: true },
  });
  if (!membership) return NextResponse.json({ error: "Bu şirkete erişiminiz yok" }, { status: 403 });

  const response = NextResponse.json({ success: true });
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, membership.workspaceId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
