import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default function PendingPage() {
  const { userId, sessionClaims } = auth();

  // Not logged in → sign-in
  if (!userId) redirect('/sign-in');

  // Already provisioned → dashboard
  const lenderId = (sessionClaims?.publicMetadata as any)?.lenderId;
  if (lenderId) redirect('/');

  return (
    <div className="min-h-screen bg-[#060b18] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">

        <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto text-2xl">
          ⏳
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Your account is under review</h1>
          <p className="text-slate-400 leading-relaxed">
            We received your sign-up. If your early access request has been approved,
            your account will be provisioned automatically — this usually takes less than a minute.
          </p>
        </div>

        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5 text-left space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">What happens next</p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><span className="text-blue-400 mt-0.5">1.</span> Our team reviews your early access request</li>
            <li className="flex gap-2"><span className="text-blue-400 mt-0.5">2.</span> Once approved, you'll receive an email with your API key</li>
            <li className="flex gap-2"><span className="text-blue-400 mt-0.5">3.</span> Sign back in to access the dashboard</li>
          </ul>
        </div>

        <p className="text-xs text-slate-600">
          Questions? Email{' '}
          <a href="mailto:hello@voltledger.io" className="text-blue-400 hover:underline">
            hello@voltledger.io
          </a>
        </p>
      </div>
    </div>
  );
}
