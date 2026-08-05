import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // DB-backed tests hit a real Postgres instance and run sequentially —
    // parallel test files would otherwise race each other's inventory
    // reservations and refund state on shared fixture rows.
    fileParallelism: false,
  },
});
