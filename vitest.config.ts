import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup-env.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/**", "dist/**", "**/*.test.ts", "**/*.config.ts"],
    },
    testTimeout: 35000, // 35s for transaction confirmation tests
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./sdk/src"),
      "@/lib": path.resolve(__dirname, "./app/src/lib"),
      "@/hooks": path.resolve(__dirname, "./app/src/hooks"),
      "@/components": path.resolve(__dirname, "./app/src/components"),
    },
  },
});
