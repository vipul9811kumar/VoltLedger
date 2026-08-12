import Link from 'next/link';
import { prisma } from '@voltledger/db';

export const dynamic = 'force-dynamic';

export default async function RunsListPage() {
  const runs = await prisma.portfolioSimRun.findMany({ orderBy: { runAt: 'desc' } });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">Run history</h1>
      {runs.length === 0 ? (
        <p className="text-slate-400">No runs yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left label border-b border-border">
                <th className="py-2 pr-4">Run at</th>
                <th className="py-2 pr-4">n</th>
                <th className="py-2 pr-4">Seed</th>
                <th className="py-2 pr-4">WITH loss</th>
                <th className="py-2 pr-4">WITHOUT loss</th>
                <th className="py-2 pr-4">Loss delta</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-2 pr-4">
                    <Link href={`/runs/${r.id}`} className="text-accent">
                      {r.runAt.toLocaleString()}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{r.nLoans}</td>
                  <td className="py-2 pr-4">{r.seed}</td>
                  <td className="py-2 pr-4">${Math.round(r.withNetLossUsd).toLocaleString()}</td>
                  <td className="py-2 pr-4">${Math.round(r.withoutNetLossUsd).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-accent">${Math.round(r.lossDeltaUsd).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
