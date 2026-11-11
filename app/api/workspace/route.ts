// YKM fork addition: list the companies (workspaces) a user belongs to, create
// a new one, and edit the current one's branding (name, logo, site, e-mail).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/ykm/active-workspace";

const brandFields = {
  id: true,
  name: true,
  brandName: true,
  logoUrl: true,
  websiteUrl: true,
  contactEmail: true,
} as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const brandingSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  brandName: optionalText(80),
  logoUrl: optionalText(500).refine(
    (v) => v == null || v.startsWith("/") || /^https:\/\//.test(v),
    "Logo adresi https:// ile ya da / ile başlamalı"
  ),
  websiteUrl: optionalText(200),
  contactEmail: optionalText(200).refine(
    (v) => v == null || z.string().email().safeParse(v).success,
    "Geçerli bir e-posta girin"
  ),
});

const createSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: context.userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      workspace: {
        select: {
          ...brandFields,
          _count: { select: { automations: true, instagramAccounts: true } },
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      currentId: context.workspaceId,
      canManage: canManageWorkspace(context.role),
      workspaces: memberships.map((m) => ({ ...m.workspace, role: m.role })),
    },
  });
}

export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Şirket adı gerekli" }, { status: 400 });
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: parsed.data.name,
      brandName: parsed.data.name,
      ownerId: context.userId,
      members: { create: { userId: context.userId, role: "OWNER" } },
    },
    select: brandFields,
  });

  const response = NextResponse.json({ success: true, data: workspace });
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function PATCH(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici olmalısınız" }, { status: 403 });
  }

  const parsed = brandingSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi" },
      { status: 400 }
    );
  }

  const workspace = await prisma.workspace.update({
    where: { id: context.workspaceId },
    data: parsed.data,
    select: brandFields,
  });

  return NextResponse.json({ success: true, data: workspace });
}
