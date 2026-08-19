import { z } from "zod";
import * as authRepository from "../../src/modules/auth/auth.repository.js";
import * as usuariosRepository from "../../src/modules/usuarios/usuarios.repository.js";
import { hash } from "../../src/modules/auth/password.js";
import { leerCsv, texto, textoOpcional } from "./csv.js";
import { normalizar, type Contexto, type ResumenModulo } from "./contexto.js";

const FilaUsuarioSchema = z.object({
    email: z.email(),
    role: z.enum(["user", "admin"]),
    nombre: z.string().trim().min(1),
    apellidos: z.string().trim().min(1).optional(),
    apodo: z.string().trim().min(1).optional(),
    telefono: z.string().trim().min(1).optional(),
});

type FilaUsuario = z.infer<typeof FilaUsuarioSchema>;

export async function cargar(ctx: Contexto, opciones: { dryRun: boolean }): Promise<ResumenModulo> {
    const password = process.env.CARGA_PASSWORD;
    if (!password || password.length < 12) {
        return {
            creados: 0,
            actualizados: 0,
            errores: ["Falta CARGA_PASSWORD en el entorno (mínimo 12 caracteres)."],
        };
    }

    const filas = leerCsv("usuarios.csv");
    const errores: string[] = [];
    const validas: FilaUsuario[] = [];
    const vistos = new Set<string>();

    filas.forEach((fila, i) => {
        const linea = i + 2;
        const candidato = {
            email: texto(fila.email),
            role: texto(fila.role),
            nombre: texto(fila.nombre),
            apellidos: textoOpcional(fila.apellidos),
            apodo: textoOpcional(fila.apodo),
            telefono: textoOpcional(fila.telefono),
        };
        const resultado = FilaUsuarioSchema.safeParse(candidato);
        if (!resultado.success) {
            errores.push(`usuarios.csv línea ${linea}: ${resultado.error.issues.map((iss) => iss.message).join(", ")}`);
            return;
        }

        const clave = normalizar(resultado.data.email);
        if (vistos.has(clave)) {
            errores.push(`usuarios.csv línea ${linea}: email "${resultado.data.email}" duplicado en el fichero.`);
            return;
        }
        vistos.add(clave);
        validas.push(resultado.data);
    });

    if (errores.length > 0) {
        return { creados: 0, actualizados: 0, errores };
    }

    let creados = 0;
    let actualizados = 0;

    for (const fila of validas) {
        const existente = await authRepository.findUserByEmail(fila.email);
        let usuarioId: string;

        if (existente) {
            usuarioId = existente.id;
            if (!opciones.dryRun) {
                await usuariosRepository.updatePerfil(usuarioId, {
                    nombre: fila.nombre,
                    apellidos: fila.apellidos,
                    apodo: fila.apodo,
                    telefono: fila.telefono,
                });
            }
            actualizados++;
        } else if (opciones.dryRun) {
            creados++;
            continue;
        } else {
            const passwordHash = await hash(password);
            const creado = await authRepository.createUser({
                email: fila.email,
                passwordHash,
                nombre: fila.nombre,
                role: fila.role,
            });
            usuarioId = creado.id;
            await usuariosRepository.updatePerfil(usuarioId, {
                apellidos: fila.apellidos,
                apodo: fila.apodo,
                telefono: fila.telefono,
            });
            creados++;
        }

        ctx.usuariosPorEmail.set(normalizar(fila.email), usuarioId);
        if (fila.apodo) {
            ctx.usuariosPorApodo.set(normalizar(fila.apodo), usuarioId);
        }
    }

    return { creados, actualizados, errores: [] };
}
