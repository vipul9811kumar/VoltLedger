'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import clsx from 'clsx';

const NAV = [
  { href: '/fleet-ops',             label: 'Readiness',     icon: '◈' },
  { href: '/fleet-ops/alerts',      label: 'Alerts',        icon: '⚑' },
  { href: '/fleet-ops/replace',     label: 'Replace Queue', icon: '↻' },
  { href: '/fleet-ops/second-life', label: 'Second Life',   icon: '♻' },
];

export function FleetOpsSidebar() {
  const path = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 border-r border-[#1a2e1a] bg-[#0a140a] flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1a2e1a]">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-xl">⚡</span>
          <span className="font-semibold text-white text-sm tracking-wide">VoltLedger</span>
        </div>
        <p className="text-[10px] text-emerald-700 mt-0.5 ml-7">Fleet Ops</p>
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
                ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                : 'text-slate-400 hover:text-white hover:bg-white/5',
            )}
          >
            <span className="text-base w-4 text-center">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* Context switcher */}
      <div className="px-3 py-3 border-t border-[#1a2e1a]">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-blue-400 hover:bg-blue-500/5 transition-colors w-full"
        >
          <span className="text-sm">⇄</span>
          <span>Switch to Lender View</span>
        </Link>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#1a2e1a] flex items-center gap-3">
        <UserButton />
        <p className="text-[10px] text-slate-600 font-mono">FLEET v1.0</p>
      </div>
    </aside>
  );
}
