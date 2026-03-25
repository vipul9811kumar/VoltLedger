import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0f1e]">
      <SignUp signInUrl="/sign-in" />
    </div>
  );
}