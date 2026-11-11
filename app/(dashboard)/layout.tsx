import { I18nProvider } from "@/lib/i18n/provider";
import { getI18n } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser } from "@/lib/workspace";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("OpenReply - Open source Instagram comment-to-DM automation") };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = await getI18n();
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const workspace = await ensureWorkspaceForUser(
    session.user.id,
    session.user.email
  );
  const [accounts, memberships] = await Promise.all([
    prisma.instagramAccount.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { connectedAt: "desc" },
      select: { username: true },
    }),
    prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: {
        workspace: {
          select: {
            id: true,
            name: true,
            brandName: true,
            logoUrl: true,
            websiteUrl: true,
            contactEmail: true,
            _count: { select: { automations: true } },
          },
        },
      },
    }),
  ]);
  const companies = memberships.map(({ workspace: w }) => ({
    id: w.id,
    name: w.name,
    brandName: w.brandName,
    logoUrl: w.logoUrl,
    websiteUrl: w.websiteUrl,
    contactEmail: w.contactEmail,
    campaignCount: w._count.automations,
  }));
  const company =
    companies.find((c) => c.id === workspace.id) ?? {
      id: workspace.id,
      name: workspace.name,
      brandName: workspace.brandName,
      logoUrl: workspace.logoUrl,
      websiteUrl: workspace.websiteUrl,
      contactEmail: workspace.contactEmail,
      campaignCount: 0,
    };

  return (
    <I18nProvider locale={locale}>
      <DashboardShell
        company={company}
        companies={companies}
        instagramUsername={accounts[0]?.username ?? null}
        instagramAccountCount={accounts.length}
      >
        {children}
      </DashboardShell>
    </I18nProvider>
  );
}
