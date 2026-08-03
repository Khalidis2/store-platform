const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.*)$/m);
    if (match) return match[1].trim();
  }

  throw new Error("DATABASE_URL is not set (checked process.env and .env.local)");
}

async function main() {
  const connectionString = loadDatabaseUrl();
  const schemaPath = path.join(__dirname, "..", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    console.log("schema.sql applied successfully");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Failed to push schema:", err.message);
  process.exit(1);
});
