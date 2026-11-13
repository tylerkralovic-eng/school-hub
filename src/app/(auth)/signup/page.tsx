import { SignUpForm } from "@/components/AuthForms";

export const metadata = { title: "Create account · School Hub" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Your family owns its School Hub. Each parent gets their own login — no shared passwords.
      </p>
      <SignUpForm next={next} />
    </>
  );
}
