'use client';

import { useEffect, useState } from 'react';
import { useAuth, useSession } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

type State = 'checking' | 'metadata_failed' | 'pending' | 'error';

export default function PendingPage() {
  const { userId, isLoaded } = useAuth();
  const { session }          = useSession();
  const router               = useRouter();
  const [state, setState]       = useState<State>('checking');
  const [retrying, setRetrying] = useState(false);
  const [detail, setDetail]     = useState('');

  async function tryProvision() {
    try {
      const res  = await fetch('/api/provision/retry', { method: 'POST' });
      const data = await res.json();

      if (data.provisioned && data.metadataSet === false) {
        setDetail(data.metadataError ?? 'unknown');
        setState('metadata_failed');
      } else if (data.provisioned) {
        // Reload the session so the new JWT carries lenderId, then go straight to dashboard
        await session?.reload();
        window.location.href = '/';
        return;
      } else if (data.error) {
        setDetail(data.error + (data.detail ? ': ' + data.detail : ''));
        setState('error');
      } else {
        setState('pending');
      }
    } catch (err: any) {
      setDetail(err?.message ?? 'Network error');
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
          state === 'metadata_failed' ? 'bg-orange-400/10 border border-orange-400/20' :
          state === 'error'           ? 'bg-red-400/10 border border-red-400/20'        :
                                        'bg-amber-400/10 border border-amber-400/20'
        }`}>
          {state === 'metadata_failed' ? '⚠️' : state === 'error' ? '❌' : '⏳'}
        </div>

        {/* Checking */}
        {state === 'checking' && (
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Activating your account…</h1>
            <p className="text-slate-400">Checking your access status.</p>
          </div>
        )}

        {/* DB provisioned but Clerk metadata update failed */}
        {state === 'metadata_failed' && (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Almost there</h1>
              <p className="text-slate-400 leading-relaxed">
                Your account was created but the final access step failed.
                Contact support with the error below.
              </p>
              <p className="text-xs text-orange-400/80 font-mono break-all bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2 mt-2">
                {detail}
              </p>
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

        {/* Not yet approved */}
        {state === 'pending' && (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Your account is under review</h1>
              <p className="text-slate-400 leading-relaxed">
                Once your early access request is approved, click{' '}
                <strong className="text-white">Activate Account</strong> below to get in.
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

        {/* Hard error */}
        {state === 'error' && (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
              {detail && (
                <p className="text-xs text-red-400/70 font-mono break-all bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                  {detail}
                </p>
              )}
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
