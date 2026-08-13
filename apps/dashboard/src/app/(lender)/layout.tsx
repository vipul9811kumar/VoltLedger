import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@voltledger/db';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';

export default async function LenderLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();
  if (!userId) redirect('/sign-in');

  const adminId = process.env.ADMIN_CLERK_USER_ID;
  const isAdmin = !!adminId && userId === adminId;

  if (!isAdmin) {
    const lenderUser = await prisma.lenderUser.findUnique({ where: { clerkId: userId } });
    if (!lenderUser) redirect('/pending');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 overflow-y-auto">
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-1.5 text-[11px] text-yellow-300/90 font-mono flex items-center justify-between">
          <span>Portfolio data in this portal is SIMULATED_CALIBRATED (demo data) unless a battery states otherwise.</span>
          <Link href="/validation" className="text-yellow-300 hover:underline shrink-0 ml-4">Validation evidence →</Link>
        </div>
        {children}
      </main>
    </div>
  );
}
