import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/AuthForms";
import { getUser } from "@/lib/server/context";

export default async function ResetPasswordPage() {
  const { user } = await getUser();
  if (!user) redirect("/login");
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <ResetPasswordForm />
    </div>
  );
}
