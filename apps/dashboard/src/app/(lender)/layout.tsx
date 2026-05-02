import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@voltledger/db';
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
        {children}
      </main>
    </div>
  );
}
