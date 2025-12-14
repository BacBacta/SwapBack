import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup-env.ts"],
    include: [
      "app/src/**/*.{test,spec}.{ts,tsx}",
      "sdk/src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "node_modules/**",
      "dist/**",
      "**/node_modules/**",
      "app/e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/**", "dist/**", "**/*.test.ts", "**/*.config.ts"],
    },
    testTimeout: 35000, // 35s for transaction confirmation tests
  },
  resolve: {
    alias: {
      "@/lib": path.resolve(__dirname, "./app/src/lib"),
      "@/hooks": path.resolve(__dirname, "./app/src/hooks"),
      "@/components": path.resolve(__dirname, "./app/src/components"),
      "@/config": path.resolve(__dirname, "./app/src/config"),
      "@/store": path.resolve(__dirname, "./app/src/store"),
      "@/idl": path.resolve(__dirname, "./app/src/idl"),
      "@/utils": path.resolve(__dirname, "./app/src/utils"),
      "@/sdk": path.resolve(__dirname, "./app/src/sdk"),
      "@": path.resolve(__dirname, "./sdk/src"),
    },
  },
});
