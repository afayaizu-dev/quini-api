import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((v) => v === "true");

const EnvSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    API_BASE_URL: z.url(),
    PUBLIC_APP_URL: z.url(),
    CORS_ORIGINS: z
        .string()
        .transform((v) => v.split(",").map((origin) => origin.trim())),
    DB_MODE: z.enum(["docker", "embedded"]).default("docker"),
    DATABASE_URL: z.string().min(1),
    JWT_ISSUER: z.string().min(1),
    JWT_AUDIENCE: z.string().min(1),
    JWT_ALG: z.enum(["HS256", "RS256"]).default("HS256"),
    JWT_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL: z.string().min(1),
    REFRESH_TOKEN_TTL: z.string().min(1),
    COOKIE_SECRET: z.string().min(32),
    INVITATION_TTL: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.url().optional(),
    GMAIL_REFRESH_TOKEN: z.string().optional(),
    GMAIL_SENDER_EMAIL: z.string().email().optional(),
    APP_COMMIT: z.string().optional(),
    METRICS_ENABLED: booleanString.default(true),
    METRICS_PATH: z.string().default("/metrics"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Variables de entorno inválidas:");
    console.error(z.treeifyError(parsed.error));
    process.exit(1);
}

export const env = parsed.data;