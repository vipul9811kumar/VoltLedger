import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@voltledger/db';
import { FleetOpsSidebar } from '@/components/FleetOpsSidebar';

export const metadata = {
  title: 'VoltLedger — Fleet Ops',
  description: 'Fleet readiness and battery health for EV operators',
};

export default async function FleetOpsLayout({ children }: { children: React.ReactNode }) {
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
      <FleetOpsSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
