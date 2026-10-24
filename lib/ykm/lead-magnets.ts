// YKM fork addition: lead magnet PDFs served from this app at /pdf/<kod>.
// Google Drive links often fail inside Instagram's in-app browser (blank
// preview or a sign-in wall, mostly on Android), so each PDF is also shown as
// page images that open in any browser, with the PDF itself as a download.
// Files live in public/ykm/pdf/<kod>.pdf and public/ykm/pdf/<kod>/<n>.jpg.

export type LeadMagnet = {
  title: string;
  pages: number;
};

export const LEAD_MAGNETS: Record<string, LeadMagnet> = {
  mebi: { title: "İlk MEBİ Denemesi Öncesi 10 Günlük Matematik Planı", pages: 4 },
  kat: { title: "Çarpanlar ve Katlar: 3 Yeni Nesil Soru ve Çözümü", pages: 5 },
  hata: { title: "Çarpanlar ve Katlar: 3 Kritik Hata ve Doğru Çözümleri", pages: 5 },
  kaynak: { title: "Kareköklü İfadeler Kaynak Yol Haritası", pages: 5 },
  uslu: { title: "Üslü İfadeler 8 Günlük Plan", pages: 5 },
};
