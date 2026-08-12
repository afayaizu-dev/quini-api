import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        globalSetup: "./tests/setup/global-setup.ts",
        setupFiles: ["./tests/setup/truncate.ts"],
        pool: "forks",
        fileParallelism: false,
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            thresholds: {
                lines: 80,
                statements: 80,
                branches: 80,
                functions: 80,
                "src/modules/auth/auth.service.ts": { 100: true },
                "src/modules/invitations/invitations.service.ts": { 100: true },
            },
        },
    },
});
