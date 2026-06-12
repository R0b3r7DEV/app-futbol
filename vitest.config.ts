import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests en Node (el motor Poisson no necesita DOM).
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
