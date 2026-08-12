import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Portfolio Loss Simulation · VoltLedger',
  description: 'WS-D counterfactual portfolio loss simulator — results and methodology parameters',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-navy text-slate-200 min-h-screen">
        <header className="border-b border-border bg-card/50">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-8">
            <span className="font-semibold text-slate-100">
              Portfolio Loss Simulation <span className="text-slate-500 font-normal">— WS-D</span>
            </span>
            <nav className="flex gap-5 text-sm">
              <Link href="/" className="text-slate-300 hover:text-accent">Latest run</Link>
              <Link href="/runs" className="text-slate-300 hover:text-accent">Run history</Link>
              <Link href="/parameters" className="text-slate-300 hover:text-accent">Parameters</Link>
            </nav>
            <span className="badge-simulated text-xs px-2 py-1 rounded font-mono ml-auto">SIMULATED_CALIBRATED</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
