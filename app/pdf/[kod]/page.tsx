// YKM fork addition: a lead magnet PDF as a plain page of images, so it opens
// inside Instagram's in-app browser where Drive previews and inline PDFs fail.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEAD_MAGNETS } from "@/lib/ykm/lead-magnets";

type PageProps = { params: Promise<{ kod: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(LEAD_MAGNETS).map((kod) => ({ kod }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { kod } = await params;
  const magnet = LEAD_MAGNETS[kod];
  return {
    title: magnet ? `${magnet.title} · Yasin Kurt Matematik` : "Yasin Kurt Matematik",
    robots: { index: false, follow: false },
  };
}

export default async function LeadMagnetPage({ params }: PageProps) {
  const { kod } = await params;
  const magnet = LEAD_MAGNETS[kod];
  if (!magnet) notFound();

  const pdfUrl = `/ykm/pdf/${kod}.pdf`;
  const pages = Array.from({ length: magnet.pages }, (_, i) => i + 1);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f2f2f4",
        color: "#1d1d1f",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "20px 12px 48px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "#6e6e73" }}>
          Yasin Kurt Matematik
        </p>
        <h1 style={{ margin: "0 0 16px", fontSize: 22, lineHeight: 1.25 }}>
          {magnet.title}
        </h1>
        <a
          href={pdfUrl}
          download
          style={{
            display: "block",
            textAlign: "center",
            background: "#0071e3",
            color: "#fff",
            borderRadius: 12,
            padding: "14px 16px",
            fontWeight: 600,
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          PDF olarak indir
        </a>
        {pages.map((n) => (
          // Plain <img>: static files, no resizing needed, and nothing that
          // depends on JavaScript running in an in-app browser.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={n}
            src={`/ykm/pdf/${kod}/${n}.jpg`}
            alt={`${magnet.title}, sayfa ${n}`}
            width={1080}
            height={1527}
            loading={n === 1 ? "eager" : "lazy"}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              marginBottom: 12,
            }}
          />
        ))}
        <a
          href={pdfUrl}
          download
          style={{
            display: "block",
            textAlign: "center",
            color: "#0071e3",
            padding: "12px 16px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          PDF olarak indir
        </a>
      </div>
    </main>
  );
}
