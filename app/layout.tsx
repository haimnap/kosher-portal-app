import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/components/i18n/LanguageProvider';
import { getLang } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Latin America Kosher — Certification Portal',
  description: 'Manage and access your kosher certifications',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();

  return (
    <html lang={lang}>
      <body className="bg-slate-50 text-slate-900">
        <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
