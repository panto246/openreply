"use client";

/**
 * Sidebar Navigation
 *
 * YKM fork: icon nav plus a company (workspace) card. Each company carries its
 * own logo, panel name, website and e-mail; the card switches between the
 * companies the user belongs to and can add a new one.
 */

import LanguageSwitcher from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n/provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  Check,
  ChevronsUpDown,
  Inbox,
  LayoutGrid,
  MessageSquare,
  Plus,
  Send,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Overview", href: "/overview", icon: BarChart3 },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Campaigns", href: "/campaigns", icon: Send },
  { label: "DM Logs", href: "/logs", icon: MessageSquare },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Diagnostics", href: "/diagnostics", icon: Activity },
] as const;

export type SidebarCompany = {
  id: string;
  name: string;
  brandName: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  campaignCount: number;
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  company: SidebarCompany;
  companies: SidebarCompany[];
  instagramUsername: string | null;
}

function displayName(company: SidebarCompany) {
  return company.brandName || company.name;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toLocaleUpperCase("tr") || "?";
}

function shortSite(url: string | null) {
  return url ? url.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;
}

function CompanyMark({ company, size }: { company: SidebarCompany; size: number }) {
  const name = displayName(company);
  if (company.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={company.logoUrl}
        alt={`${name} logosu`}
        width={size}
        height={size}
        className="shrink-0 rounded-[10px] border border-border bg-white object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-[10px] bg-foreground text-sm font-bold text-white"
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}

export default function Sidebar({
  isOpen,
  onClose,
  company,
  companies,
  instagramUsername,
}: SidebarProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(id: string) {
    if (id === company.id) {
      setMenuOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: id }),
    });
    if (res.ok) {
      window.location.assign("/dashboard");
    } else {
      setBusy(false);
      setError(t("Could not switch company"));
    }
  }

  async function addCompany(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      window.location.assign("/settings");
    } else {
      setBusy(false);
      setError(t("Could not switch company"));
    }
  }

  const site = shortSite(company.websiteUrl);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-dvh w-72 max-w-[85vw] shrink-0 bg-surface border-r border-border flex flex-col
          transition-transform duration-200 ease-out
          lg:h-full lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Same reason as the top bar: the drawer is full height, so the
            card would otherwise land under the status bar. */}
        <div
          className="relative px-4 pb-3"
          style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            aria-label={`${t("Switch company")}: ${displayName(company)}`}
            className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left hover:border-border-hover"
          >
            <CompanyMark company={company} size={44} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-2 text-sm font-bold leading-tight text-foreground">
                {displayName(company)}
              </span>
              {site && <span className="truncate text-xs text-muted">{site}</span>}
            </span>
            <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
          </button>

          {(company.contactEmail || instagramUsername) && (
            <div className="flex flex-col gap-0.5 px-3 pt-2 text-xs text-muted">
              {company.contactEmail && <span className="truncate">{company.contactEmail}</span>}
              {instagramUsername && <span className="truncate">@{instagramUsername}</span>}
            </div>
          )}

          {menuOpen && (
            <div className="absolute left-4 right-4 top-full z-10 mt-1 flex flex-col gap-1 rounded-2xl border border-border bg-surface p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
              <p className="px-2 pb-1 pt-1 text-xs font-semibold text-muted">{t("Companies")}</p>
              <ul role="listbox" aria-label={t("Companies")} className="flex flex-col gap-1">
                {companies.map((item) => (
                  <li key={item.id} role="option" aria-selected={item.id === company.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => switchTo(item.id)}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${
                        item.id === company.id ? "bg-accent-soft" : "hover:bg-surface-hover"
                      }`}
                    >
                      <CompanyMark company={item} size={36} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{displayName(item)}</span>
                        <span className="truncate text-xs text-muted">
                          {t("{count} campaigns", { count: item.campaignCount })}
                        </span>
                      </span>
                      {item.id === company.id && (
                        <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              {adding ? (
                <form onSubmit={addCompany} className="flex flex-col gap-2 p-2">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                    {t("Company name")}
                    <input
                      autoFocus
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      maxLength={80}
                      className="min-h-10 rounded-lg border border-border px-3 text-sm font-normal text-foreground"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy || !newName.trim()}
                    className="min-h-10 rounded-lg bg-accent text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    {t("Create")}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-border-hover text-sm font-semibold text-foreground hover:bg-surface-hover"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  {t("Add company")}
                </button>
              )}
              {error && <p role="alert" className="px-2 text-xs text-error">{error}</p>}
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${
                  isActive
                    ? "bg-accent-soft font-semibold text-accent"
                    : "font-medium text-foreground/80 hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />
                {t(item.label)}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-5 py-4">
          <LanguageSwitcher />
        </div>
      </aside>
    </>
  );
}
