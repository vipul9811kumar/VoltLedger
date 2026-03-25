import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0f1e]">
      <SignIn />
    </div>
  );
}