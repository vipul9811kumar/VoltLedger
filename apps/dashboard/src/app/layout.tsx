import type { Metadata } from 'next';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'VoltLedger',
  description: 'Battery intelligence for EVs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/sign-in" signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en">
        <body className="bg-[#0a0f1e]">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
