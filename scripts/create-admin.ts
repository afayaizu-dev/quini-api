import { createInterface } from "node:readline/promises";
import { pool } from "../src/db/index.js";
import { createUser, hasAdmin } from "../src/modules/auth/auth.repository.js";
import { hash } from "../src/modules/auth/password.js";

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
    const args = parseArgs(process.argv.slice(2));
    const email = args.email;
    const nombre = args.nombre;
    const force = args.force === true;

    if (typeof email !== "string" || typeof nombre !== "string") {
        console.error("Uso: npm run admin:create -- --email=... --nombre=... [--force]");
        process.exitCode = 1;
        return;
    }

    if (!force && (await hasAdmin())) {
        console.error("Ya existe un admin. Usa --force si de verdad quieres crear otro.");
        process.exitCode = 1;
        return;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const password = await rl.question("Contraseña (mínimo 12 caracteres): ");
    rl.close();

    if (password.length < 12) {
        console.error("La contraseña debe tener al menos 12 caracteres.");
        process.exitCode = 1;
        return;
    }

    const passwordHash = await hash(password);
    const user = await createUser({ email, passwordHash, nombre, role: "admin" });

    console.log(`Admin creado: ${user.email} (${user.id})`);
}

main()
    .catch((err: unknown) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());