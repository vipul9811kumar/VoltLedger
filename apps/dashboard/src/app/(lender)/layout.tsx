import { auth } from '@clerk/nextjs/server';
import { Sidebar } from '@/components/Sidebar';

export default function LenderLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();
  const adminId    = process.env.ADMIN_CLERK_USER_ID;
  const isAdmin    = !!adminId && userId === adminId;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
