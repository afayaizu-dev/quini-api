import * as temporadasRepository from "../../src/modules/temporadas/temporadas.repository.js";
import * as equiposRepository from "../../src/modules/equipos/equipos.repository.js";
import * as usuariosRepository from "../../src/modules/usuarios/usuarios.repository.js";
import * as jornadasRepository from "../../src/modules/jornadas/jornadas.repository.js";

export interface Contexto {
    equiposPorNombre: Map<string, string>;
    temporadasPorCodigo: Map<string, string>;
    usuariosPorEmail: Map<string, string>;
    usuariosPorApodo: Map<string, string>;
    jornadasPorClave: Map<string, string>;
}

export interface ResumenModulo {
    creados: number;
    actualizados: number;
    errores: string[];
}

export function crearContexto(): Contexto {
    return {
        equiposPorNombre: new Map(),
        temporadasPorCodigo: new Map(),
        usuariosPorEmail: new Map(),
        usuariosPorApodo: new Map(),
        jornadasPorClave: new Map(),
    };
}

export function normalizar(t: string): string {
    return t.trim().toLowerCase();
}

export function claveJornada(codigoTemporada: string, numeroJornada: number): string {
    return `${codigoTemporada}#${numeroJornada}`;
}

// Si la clave no está en el contexto en memoria (el módulo del que depende no
// corrió en este mismo proceso, p.ej. con --solo), se busca en la BD y se cachea.

export async function resolverTemporada(ctx: Contexto, codigo: string): Promise<string | undefined> {
    const cacheado = ctx.temporadasPorCodigo.get(codigo);
    if (cacheado) return cacheado;
    const fila = await temporadasRepository.findByCodigo(codigo);
    if (fila) ctx.temporadasPorCodigo.set(codigo, fila.id);
    return fila?.id;
}

export async function resolverEquipo(ctx: Contexto, nombreLargo: string): Promise<string | undefined> {
    const clave = normalizar(nombreLargo);
    const cacheado = ctx.equiposPorNombre.get(clave);
    if (cacheado) return cacheado;
    const fila = await equiposRepository.findByNombreLargo(nombreLargo);
    if (fila) ctx.equiposPorNombre.set(clave, fila.id);
    return fila?.id;
}

export async function resolverUsuarioPorApodo(ctx: Contexto, apodo: string): Promise<string | undefined> {
    const clave = normalizar(apodo);
    const cacheado = ctx.usuariosPorApodo.get(clave);
    if (cacheado) return cacheado;

    const todos = await usuariosRepository.findAll();
    for (const u of todos) {
        if (u.apodo) ctx.usuariosPorApodo.set(normalizar(u.apodo), u.id);
        ctx.usuariosPorEmail.set(normalizar(u.email), u.id);
    }
    return ctx.usuariosPorApodo.get(clave);
}


export async function resolverJornadaActivaPorNumero(ctx: Contexto, numeroJornada: number): Promise<string | undefined> {
    const activa = await temporadasRepository.findActiva();
    if (!activa) return undefined;

    const clave = claveJornada(activa.codigo, numeroJornada);
    const cacheado = ctx.jornadasPorClave.get(clave);
    if (cacheado) return cacheado;

    const fila = await jornadasRepository.findByNumero(activa.id, numeroJornada);
    if (fila) ctx.jornadasPorClave.set(clave, fila.id);
    return fila?.id;
}