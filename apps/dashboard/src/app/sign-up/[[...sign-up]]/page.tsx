import { SignUp } from '@clerk/nextjs';

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { email_address?: string };
}) {
  const email = searchParams.email_address;

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0f1e]">
      <SignUp
        signInUrl="/sign-in"
        initialValues={email ? { emailAddress: email } : undefined}
      />
    </div>
  );
}
