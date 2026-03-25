import type { Metadata } from 'next';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'VoltLedger — Lender Portal',
  description: 'Battery intelligence dashboard for EV lenders',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();
  const adminId    = process.env.ADMIN_CLERK_USER_ID;
  const isAdmin    = !!adminId && userId === adminId;

  return (
    <ClerkProvider afterSignOutUrl="/sign-in" signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en">
        <body className="flex h-screen overflow-hidden bg-[#0a0f1e]">
          <Sidebar isAdmin={isAdmin} />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
