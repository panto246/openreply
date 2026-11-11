"use client";

// YKM fork addition: edit the current company's panel name, logo, website and
// e-mail. They show in the sidebar's company card.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

type Branding = {
  name: string;
  brandName: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
};

export default function CompanyBrandingForm() {
  const { t } = useI18n();
  const [form, setForm] = useState<Branding | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspace")
      .then((res) => res.json())
      .then((json) => {
        const current = json?.data?.workspaces?.find(
          (w: Branding & { id: string }) => w.id === json.data.currentId
        );
        if (current) setForm(current);
        setCanManage(Boolean(json?.data?.canManage));
      })
      .catch(() => setError(t("Unknown error")));
  }, [t]);

  if (!form) return <div className="panel p-6 h-40" />;

  const field = (key: keyof Branding) => ({
    value: form[key] ?? "",
    disabled: !canManage,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setState("idle");
      setForm({ ...form, [key]: event.target.value });
    },
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setState("saving");
    setError(null);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        brandName: form.brandName ?? "",
        logoUrl: form.logoUrl ?? "",
        websiteUrl: form.websiteUrl ?? "",
        contactEmail: form.contactEmail ?? "",
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setState("saved");
      window.location.reload();
    } else {
      setState("idle");
      setError(json?.error ?? t("Unknown error"));
    }
  }

  const inputClass =
    "min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground disabled:opacity-60";

  return (
    <section className="panel p-4 sm:p-6">
      <h2 className="text-base font-semibold mb-1">{t("Company details")}</h2>
      <p className="text-sm text-muted mb-6">{t("Shown in the side menu for this company.")}</p>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center gap-4">
          {form.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.logoUrl}
              alt=""
              className="h-16 w-16 rounded-2xl border border-border bg-white object-contain"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-hover text-xs text-muted">
              {t("No image")}
            </span>
          )}
          <label className="flex flex-1 flex-col gap-1.5 text-xs font-semibold text-muted">
            {t("Logo URL")}
            <input type="text" placeholder="https://…/logo.png" className={inputClass} {...field("logoUrl")} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
          {t("Panel name")}
          <input type="text" maxLength={80} className={inputClass} {...field("brandName")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
          {t("Company name")}
          <input type="text" maxLength={80} required className={inputClass} {...field("name")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
          {t("Website")}
          <input type="text" maxLength={200} className={inputClass} {...field("websiteUrl")} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
          {t("Email")}
          <input type="email" maxLength={200} className={inputClass} {...field("contactEmail")} />
        </label>
        {canManage && (
          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={state === "saving"}
              className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {state === "saving" ? t("Saving…") : t("Save changes")}
            </button>
            {state === "saved" && <span className="text-sm text-success">{t("Saved")}</span>}
            {error && <span role="alert" className="text-sm text-error">{error}</span>}
          </div>
        )}
      </form>
    </section>
  );
}
