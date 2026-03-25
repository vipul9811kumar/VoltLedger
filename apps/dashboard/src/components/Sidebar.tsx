'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import clsx from 'clsx';

const NAV = [
  { href: '/',           label: 'Overview',    icon: '◈' },
  { href: '/fleet',      label: 'Fleet',       icon: '⬡' },
  { href: '/flagged',    label: 'Flagged',     icon: '⚑' },
  { href: '/account',         label: 'Account',     icon: '⊙' },
  { href: '/admin/requests',  label: 'Requests',    icon: '✉' },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 border-r border-[#1e2d40] bg-[#0d1424] flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1e2d40]">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-xl">⚡</span>
          <span className="font-semibold text-white text-sm tracking-wide">VoltLedger</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5 ml-7">Lender Portal</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              path === href
                ? 'bg-blue-500/10 text-blue-400 font-medium'
                : 'text-slate-400 hover:text-white hover:bg-white/5',
            )}
          >
            <span className="text-base w-4 text-center">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer — user avatar + sign out */}
      <div className="px-5 py-4 border-t border-[#1e2d40] flex items-center gap-3">
        <UserButton />
        <p className="text-[10px] text-slate-600 font-mono">MODEL v1.0</p>
      </div>
    </aside>
  );
}
