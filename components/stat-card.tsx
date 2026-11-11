"use client";

import { useI18n } from "@/lib/i18n/provider";


/**
 * Stat Card
 *
 * Metric panel with label, value, and optional trend.
 */

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
}

export default function StatCard({ label, value, trend, trendUp }: StatCardProps) {
  const { t } = useI18n();
  return (
    <div className="panel p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{value}</p>
      {trend && (
        <p
          className={`mt-1 text-xs ${
            trendUp === undefined ? "text-muted" : trendUp ? "text-success" : "text-error"
          }`}
        >
          {trendUp === undefined ? trend : `${trendUp ? "Up" : t("Down")} ${trend}`}
        </p>
      )}
    </div>
  );
}
