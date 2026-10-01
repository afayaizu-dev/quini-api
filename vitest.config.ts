import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        testTimeout: 15000,
        hookTimeout: 15000,
        exclude: [...configDefaults.exclude, "dist/**"],
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
                "src/modules/temporadas/temporadas.service.ts": { 100: true },
                "src/modules/equipos/equipos.service.ts": { 100: true },
                "src/modules/jornadas/jornadas.service.ts": { 100: true },
                "src/modules/usuarios/usuarios.service.ts": { 100: true },
                "src/modules/resultados/resultados.service.ts": { 100: true },
                "src/modules/calculos/calculos.service.ts": { 100: true },
                "src/modules/calculos/calculos.algoritmo.ts": { 100: true },
                "src/modules/pagos/pagos.service.ts": { 100: true },
                "src/modules/dashboard/dashboard.service.ts": { 100: true },
            },
        },
    },
});
