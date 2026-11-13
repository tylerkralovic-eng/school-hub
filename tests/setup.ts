import fs from "node:fs";
// Load local env for integration tests (local Supabase keys).
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
