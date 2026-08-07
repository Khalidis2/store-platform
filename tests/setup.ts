import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../.env.test.local") });
config({ path: path.resolve(__dirname, "../.env.local") });

const applicationDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required for DB-backed tests. Refusing to fall back to DATABASE_URL."
  );
}

if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
  throw new Error("DB-backed tests must not run in a production environment.");
}

if (applicationDatabaseUrl && testDatabaseUrl === applicationDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL must be different from DATABASE_URL. Refusing to run destructive fixtures against the application database."
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
