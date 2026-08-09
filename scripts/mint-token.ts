import { pool } from "../src/db/index.js";
import { env } from "../src/config/env.js";
import { findUserByEmail } from "../src/modules/auth/auth.repository.js";
import { signAccessToken } from "../src/modules/auth/tokens.js";

function parseArgs(argv: string[]): Record<string, string | boolean> {
    const args: Record<string, string | boolean> = {};
    for (const arg of argv) {
        if (!arg.startsWith("--")) continue;
        const [key, value] = arg.slice(2).split("=");
        if (key) args[key] = value ?? true;
    }
    return args;
}

async function main(): Promise<void> {
    if (env.NODE_ENV === "production") {
        console.error("mint-token no está permitido con NODE_ENV=production.");
        process.exitCode = 1;
        return;
    }

    const args = parseArgs(process.argv.slice(2));
    const email = args.email;
    const role = args.role;

    if (typeof email !== "string") {
        console.error("Uso: npm run token -- --email=... [--role=admin|user]");
        process.exitCode = 1;
        return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
        console.error(`No existe ningún usuario con email ${email}.`);
        process.exitCode = 1;
        return;
    }

    if (role !== undefined && role !== "admin" && role !== "user") {
        console.error("--role debe ser 'admin' o 'user'.");
        process.exitCode = 1;
        return;
    }

    const token = await signAccessToken({
        id: user.id,
        email: user.email,
        role: typeof role === "string" ? role : user.role,
    });

    console.log(token);
}

main()
    .catch((err: unknown) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());