import type { Metadata } from 'next';

// Link ile paylaşılan ekstre: arama motorlarına kapalı, link önizlemelerinde firma/cari adı görünmez
export const metadata: Metadata = {
  title: 'Hesap Ekstresi',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
