import {
    CreateJornadaSchema,
    FechasJornadaSchema,
    PlenoJornadaSchema,
} from "../../src/modules/jornadas/jornadas.schemas.js";
import * as jornadasRepository from "../../src/modules/jornadas/jornadas.repository.js";
import { leerCsv, texto, textoOpcional } from "./csv.js";
import {
    claveJornada,
    resolverEquipo,
    resolverTemporada,
    resolverUsuarioPorApodo,
    type Contexto,
    type ResumenModulo,
} from "./contexto.js";

interface JornadaValida {
    temporadaId: string;
    temporadaCodigo: string;
    numeroJornada: number;
    fecha: string;
    creadoPorId: string;
    fechaAperturaApuestas: string | null;
    fechaCierreApuestas: string | null;
    fechaCierreJornada: string | null;
    apuestaPleno15: string | undefined;
    partidos: { orden: number; equipoLocalId: string; equipoVisitanteId: string }[];
}

export async function cargar(ctx: Contexto, opciones: { dryRun: boolean }): Promise<ResumenModulo> {
    const errores: string[] = [];

    const partidosPorJornada = new Map<string, { orden: number; equipoLocal: string; equipoVisitante: string }[]>();
    leerCsv("partidos.csv").forEach((fila, i) => {
        const linea = i + 2;
        const numJornada = texto(fila.jornada);
        const orden = Number(texto(fila.orden));
        if (!numJornada || Number.isNaN(orden)) {
            errores.push(`partidos.csv línea ${linea}: "jornada" u "orden" inválidos.`);
            return;
        }
        const lista = partidosPorJornada.get(numJornada) ?? [];
        lista.push({ orden, equipoLocal: texto(fila.equipoLocal), equipoVisitante: texto(fila.equipoVisitante) });
        partidosPorJornada.set(numJornada, lista);
    });

    const validas: JornadaValida[] = [];
    const filasJornadas = leerCsv("jornadas.csv");

    for (const [i, fila] of filasJornadas.entries()) {
        const linea = i + 2;
        const temporadaCodigo = texto(fila.temporada);
        const numeroJornada = Number(texto(fila.numeroJornada));
        const partidosCrudos = partidosPorJornada.get(String(numeroJornada)) ?? [];

        const resultadoJornada = CreateJornadaSchema.safeParse({
            temporada: temporadaCodigo || undefined,
            numeroJornada,
            fecha: texto(fila.fecha),
            partidos: partidosCrudos,
        });
        if (!resultadoJornada.success) {
            errores.push(`jornadas.csv línea ${linea}: ${resultadoJornada.error.issues.map((iss) => iss.message).join(", ")}`);
            continue;
        }

        const resultadoFechas = FechasJornadaSchema.safeParse({
            fechaAperturaApuestas: textoOpcional(fila.fechaAperturaApuestas) ?? null,
            fechaCierreApuestas: textoOpcional(fila.fechaCierreApuestas) ?? null,
            fechaCierreJornada: textoOpcional(fila.fechaCierreJornada) ?? null,
        });
        if (!resultadoFechas.success) {
            errores.push(`jornadas.csv línea ${linea}: ${resultadoFechas.error.issues.map((iss) => iss.message).join(", ")}`);
            continue;
        }

        const apuestaPleno15 = textoOpcional(fila.apuestaPleno15);
        if (apuestaPleno15 !== undefined) {
            const resultadoPleno = PlenoJornadaSchema.safeParse({ apuestaPleno15 });
            if (!resultadoPleno.success) {
                errores.push(`jornadas.csv línea ${linea}: ${resultadoPleno.error.issues.map((iss) => iss.message).join(", ")}`);
                continue;
            }
        }

        const temporadaId = await resolverTemporada(ctx, temporadaCodigo);
        if (!temporadaId) {
            errores.push(`jornadas.csv línea ${linea}: no existe la temporada "${temporadaCodigo}" (¿se cargó el paso de temporadas?).`);
            continue;
        }

        const creadoPorApodo = texto(fila.creadoPor);
        const creadoPorId = await resolverUsuarioPorApodo(ctx, creadoPorApodo);
        if (!creadoPorId) {
            errores.push(`jornadas.csv línea ${linea}: no existe ningún usuario con apodo "${creadoPorApodo}".`);
            continue;
        }

        let faltaAlgunEquipo = false;
        const partidosResueltos: { orden: number; equipoLocalId: string; equipoVisitanteId: string }[] = [];
        for (const p of resultadoJornada.data.partidos) {
            const equipoLocalId = await resolverEquipo(ctx, p.equipoLocal);
            const equipoVisitanteId = await resolverEquipo(ctx, p.equipoVisitante);
            if (!equipoLocalId) {
                errores.push(`jornadas.csv línea ${linea}: no existe el equipo "${p.equipoLocal}".`);
                faltaAlgunEquipo = true;
            }
            if (!equipoVisitanteId) {
                errores.push(`jornadas.csv línea ${linea}: no existe el equipo "${p.equipoVisitante}".`);
                faltaAlgunEquipo = true;
            }
            if (equipoLocalId && equipoVisitanteId) {
                partidosResueltos.push({ orden: p.orden, equipoLocalId, equipoVisitanteId });
            }
        }
        if (faltaAlgunEquipo) continue;

        validas.push({
            temporadaId,
            temporadaCodigo,
            numeroJornada,
            fecha: resultadoJornada.data.fecha,
            creadoPorId,
            fechaAperturaApuestas: resultadoFechas.data.fechaAperturaApuestas,
            fechaCierreApuestas: resultadoFechas.data.fechaCierreApuestas,
            fechaCierreJornada: resultadoFechas.data.fechaCierreJornada,
            apuestaPleno15,
            partidos: partidosResueltos,
        });
    }

    if (errores.length > 0) {
        return { creados: 0, actualizados: 0, errores };
    }

    let creados = 0;
    let actualizados = 0;

    for (const fila of validas) {
        const existente = await jornadasRepository.findByNumero(fila.temporadaId, fila.numeroJornada);
        let jornadaId: string;

        if (existente) {
            jornadaId = existente.id;
            if (!opciones.dryRun) {
                await jornadasRepository.replace(jornadaId, { fecha: fila.fecha, partidos: fila.partidos });
            }
            actualizados++;
        } else if (opciones.dryRun) {
            creados++;
            continue;
        } else {
            const creada = await jornadasRepository.create({
                temporadaId: fila.temporadaId,
                numeroJornada: fila.numeroJornada,
                fecha: fila.fecha,
                createdBy: fila.creadoPorId,
                partidos: fila.partidos,
            });
            jornadaId = creada.id;
            creados++;
        }

        if (!opciones.dryRun) {
            await jornadasRepository.updateFechas(jornadaId, {
                fechaAperturaApuestas: fila.fechaAperturaApuestas,
                fechaCierreApuestas: fila.fechaCierreApuestas,
                fechaCierreJornada: fila.fechaCierreJornada,
            });
            if (fila.apuestaPleno15) {
                await jornadasRepository.updatePleno(jornadaId, fila.apuestaPleno15);
            }
        }

        ctx.jornadasPorClave.set(claveJornada(fila.temporadaCodigo, fila.numeroJornada), jornadaId);
    }

    return { creados, actualizados, errores: [] };
}