export const dynamic = "force-dynamic";
export const metadata = { title: "Setup needed · School Hub" };

const REQUIRED: [string, string][] = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase → Project Settings → API → Project URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase → Project Settings → API → anon / publishable key"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase → Project Settings → API → service_role key (secret)"],
  ["APP_URL", "This site's address, e.g. https://school-hub.vercel.app"],
  ["TOKEN_ENCRYPTION_KEY", "Random secret: openssl rand -base64 32"],
  ["CRON_SECRET", "Random secret: openssl rand -hex 24"],
  ["ANTHROPIC_API_KEY", "console.anthropic.com → API keys (needed to read documents)"],
];

/** Shown when the server isn't configured. Lists missing variable NAMES only — never values. */
export default function SetupPage() {
  const missing = REQUIRED.filter(([k]) => !process.env[k]);
  return (
    <div className="mx-auto max-w-xl px-5 py-12 text-[15px] leading-relaxed text-slate-700">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">SH</span>
        <span className="text-xl font-semibold text-slate-900">School Hub</span>
      </div>
      <h1 className="text-2xl font-semibold text-slate-900">Almost there — setup needed</h1>
      <p className="mt-2">This deployment is running, but it isn&apos;t connected to its database yet. Add these environment variables in <b>Vercel → Project → Settings → Environment Variables</b>, then redeploy.</p>
      <ul className="mt-5 space-y-2">
        {REQUIRED.map(([k, hint]) => {
          const ok = !missing.some(([m]) => m === k);
          return (
            <li key={k} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="font-mono text-sm font-semibold">{ok ? "✅" : "⬜"} {k}</p>
              <p className="mt-0.5 text-sm text-slate-500">{hint}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-sm text-slate-500">Full steps: docs/DEPLOYMENT.md in the GitHub repository.</p>
    </div>
  );
}
