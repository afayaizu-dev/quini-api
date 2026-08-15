import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { users } from "../../db/schema/users.js";
import type { UpdatePerfilInput } from "./usuarios.schemas.js";

const columnasPublicas = {
    id: users.id,
    email: users.email,
    nombre: users.nombre,
    apellidos: users.apellidos,
    apodo: users.apodo,
    telefono: users.telefono,
    role: users.role,
    createdAt: users.createdAt,
};

export async function findById(id: string, tx: DbOrTx = db) {
    const [row] = await tx.select(columnasPublicas).from(users).where(eq(users.id, id));
    return row;
}

export async function findAll(tx: DbOrTx = db) {
    return tx.select(columnasPublicas).from(users);
}

export async function updatePerfil(id: string, input: UpdatePerfilInput, tx: DbOrTx = db) {
    const [row] = await tx.update(users).set(input).where(eq(users.id, id)).returning(columnasPublicas);
    return row;
}
