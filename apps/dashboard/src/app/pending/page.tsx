'use client';

import { useEffect, useState } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

type State = 'checking' | 'provisioned' | 'pending' | 'error';

export default function PendingPage() {
  const { userId, isLoaded } = useAuth();
  const { signOut }          = useClerk();
  const router               = useRouter();
  const [state, setState]    = useState<State>('checking');
  const [retrying, setRetrying] = useState(false);

  async function tryProvision() {
    try {
      const res  = await fetch('/api/provision/retry', { method: 'POST' });
      const data = await res.json();
      setState(data.provisioned ? 'provisioned' : 'pending');
    } catch {
      setState('error');
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) { router.replace('/sign-in'); return; }
    tryProvision();
  }, [isLoaded, userId]);

  async function handleRetry() {
    setRetrying(true);
    setState('checking');
    await tryProvision();
    setRetrying(false);
  }

  return (
    <div className="min-h-screen bg-[#060b18] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">

        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto text-2xl ${
          state === 'provisioned' ? 'bg-emerald-400/10 border border-emerald-400/20' :
          state === 'error'       ? 'bg-red-400/10 border border-red-400/20' :
                                    'bg-amber-400/10 border border-amber-400/20'
        }`}>
          {state === 'provisioned' ? '✅' : state === 'error' ? '⚠️' : '⏳'}
        </div>

        {state === 'checking' && (
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Activating your account…</h1>
            <p className="text-slate-400">Checking your access status.</p>
          </div>
        )}

        {state === 'provisioned' && (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Your account is ready!</h1>
              <p className="text-slate-400 leading-relaxed">
                Sign out and back in to load your dashboard access.
              </p>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/sign-in' })}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              Sign in to the Dashboard →
            </button>
          </>
        )}

        {state === 'pending' && (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Your account is under review</h1>
              <p className="text-slate-400 leading-relaxed">
                We received your sign-up. Once your early access request is approved,
                click <strong className="text-white">Activate Account</strong> below to get in.
              </p>
            </div>
            <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5 text-left space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">What happens next</p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex gap-2"><span className="text-blue-400 mt-0.5">1.</span> Our team reviews your early access request</li>
                <li className="flex gap-2"><span className="text-blue-400 mt-0.5">2.</span> Once approved, you'll receive an email confirmation</li>
                <li className="flex gap-2"><span className="text-blue-400 mt-0.5">3.</span> Click "Activate Account" below to finish setup</li>
              </ul>
            </div>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full py-3 bg-[#111827] hover:bg-[#1a2438] border border-[#1e2d40] text-white font-semibold rounded-xl transition-colors disabled:opacity-40"
            >
              {retrying ? 'Checking…' : 'Activate Account'}
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
              <p className="text-slate-400">Could not reach the provisioning service. Please try again.</p>
            </div>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full py-3 bg-[#111827] hover:bg-[#1a2438] border border-[#1e2d40] text-white font-semibold rounded-xl transition-colors disabled:opacity-40"
            >
              {retrying ? 'Retrying…' : 'Try Again'}
            </button>
          </>
        )}

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
