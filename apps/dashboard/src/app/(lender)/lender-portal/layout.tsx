import Link from 'next/link';

export default function LenderPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Lender Portal</h1>
        <p className="text-slate-500 text-sm mt-1">
          A loan-origination harness demonstrating VoltLedger&apos;s live API mid-underwriting.
        </p>
      </div>

      <nav className="flex gap-5 text-sm border-b border-border pb-3">
        <Link href="/lender-portal" className="text-slate-300 hover:text-accent">New application</Link>
        <Link href="/lender-portal/policy" className="text-slate-300 hover:text-accent">Lender policy</Link>
        <Link href="/lender-portal/decisions" className="text-slate-300 hover:text-accent">Decision log</Link>
      </nav>

      {children}
    </div>
  );
}
