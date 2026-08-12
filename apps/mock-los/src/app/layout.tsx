import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mock LOS · VoltLedger integration demo',
  description: 'A thin loan-origination harness demonstrating the VoltLedger API mid-underwriting',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-navy text-slate-200 min-h-screen">
        <header className="border-b border-border bg-card/50">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-8">
            <span className="font-semibold text-slate-100">
              Mock LOS <span className="text-slate-500 font-normal">— VoltLedger integration demo</span>
            </span>
            <nav className="flex gap-5 text-sm">
              <Link href="/" className="text-slate-300 hover:text-accent">New application</Link>
              <Link href="/policy" className="text-slate-300 hover:text-accent">Lender policy</Link>
              <Link href="/decisions" className="text-slate-300 hover:text-accent">Decision log</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
