import { config } from "dotenv";
import path from "path";

// Vitest doesn't understand Next.js's .env.local convention — load it
// explicitly so tests hit the same database/Supabase project as
// `npm run dev`. See ROADMAP.md: this is currently the same database as
// production, so DB-backed tests must clean up everything they create.
config({ path: path.resolve(__dirname, "../.env.local") });
