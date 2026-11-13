import { SignInForm } from "@/components/AuthForms";

export const metadata = { title: "Sign in · School Hub" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">All your children&apos;s school updates in one place.</p>
      <SignInForm next={next} linkError={error === "link"} />
    </>
  );
}
