import "server-only";

/**
 * Central, typed access to environment configuration. Optional integrations
 * report whether they're configured so the UI can show honest status instead
 * of pretending to be connected.
 */
function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function req(name: string): string {
  const v = opt(name);
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => req("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRoleKey: () => req("SUPABASE_SERVICE_ROLE_KEY"),
  appUrl: () => (opt("APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
  tokenEncryptionKey: () => req("TOKEN_ENCRYPTION_KEY"),
  cronSecret: () => opt("CRON_SECRET"),
  anthropicKey: () => opt("ANTHROPIC_API_KEY"),
  aiModel: () => opt("AI_MODEL") ?? "claude-opus-5-5",
  googleClientId: () => opt("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => opt("GOOGLE_CLIENT_SECRET"),
  twilioAuthToken: () => opt("TWILIO_AUTH_TOKEN"),
  twilioAccountSid: () => opt("TWILIO_ACCOUNT_SID"),
  twilioPhoneNumber: () => opt("TWILIO_PHONE_NUMBER"),
  smtpUrl: () => opt("SMTP_URL"),
  emailFrom: () => opt("EMAIL_FROM") ?? "School Hub <no-reply@localhost>",
  /**
   * Test mode swaps the AI model for a deterministic stub so automated tests
   * can run without an API key. It is refused on Vercel production.
   */
  testMode: () => opt("SCHOOLHUB_TEST_MODE") === "1" && process.env.VERCEL_ENV !== "production",
};

export const features = {
  ai: () => Boolean(env.anthropicKey()) || env.testMode(),
  aiIsStub: () => !env.anthropicKey() && env.testMode(),
  gmail: () => Boolean(env.googleClientId() && env.googleClientSecret()),
  sms: () => Boolean(env.twilioAuthToken() && env.twilioPhoneNumber()),
  email: () => Boolean(env.smtpUrl()),
};
