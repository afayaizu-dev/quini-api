import { and, desc, eq, lte, sql, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { resultadosMiembro } from "../../db/schema/resultados_miembro.js";
import { jornadas } from "../../db/schema/jornadas.js";
import { ajustesBote } from "../../db/schema/ajustes_bote.js";

export interface AgregadosFiltros {
    temporadaId?: string | undefined;
    jornadaId?: string | undefined;
    usuarioId?: string | undefined;
    hastaNumeroJornada?: number | undefined; // numero_jornada <= n
}

export interface Agregados {
    sumaImporteEscalon: number;
    sumaPremios: number;
    sumaBote: number;
    mediaAciertosMax: number | null;
    maxAciertos: number | null;
    minAciertos: number | null;
    maxPremio: number | null;
    mediaAciertosAmbas: number | null;
    jornadasCalculadas: number;
}

export async function agregados(filtros: AgregadosFiltros, tx: DbOrTx = db): Promise<Agregados> {
    const condiciones = [];
    if (filtros.temporadaId !== undefined) condiciones.push(eq(jornadas.temporadaId, filtros.temporadaId));
    if (filtros.jornadaId !== undefined) condiciones.push(eq(resultadosMiembro.jornadaId, filtros.jornadaId));
    if (filtros.usuarioId !== undefined) condiciones.push(eq(resultadosMiembro.usuarioId, filtros.usuarioId));
    if (filtros.hastaNumeroJornada !== undefined)
        condiciones.push(lte(jornadas.numeroJornada, filtros.hastaNumeroJornada));

    const [row] = await tx
        .select({
            sumaImporteEscalon: sql<string>`COALESCE(SUM(${resultadosMiembro.importeEscalon}), 0)`,
            sumaPremios: sql<string>`COALESCE(SUM(${resultadosMiembro.premioApuesta1} + ${resultadosMiembro.premioApuesta2}), 0)`,
            sumaBote: sql<string>`COALESCE(SUM(${resultadosMiembro.bote}), 0)`,
            mediaAciertosMax: sql<string | null>`AVG(${resultadosMiembro.aciertosMax})`,
            maxAciertos: sql<number | null>`MAX(${resultadosMiembro.aciertosMax})`,
            minAciertos: sql<number | null>`MIN(${resultadosMiembro.aciertosMax})`,
            maxPremio: sql<string | null>`MAX(GREATEST(${resultadosMiembro.premioApuesta1}, ${resultadosMiembro.premioApuesta2}))`,
            mediaAciertosAmbas: sql<string | null>`
                (SUM(COALESCE(${resultadosMiembro.aciertosApuesta1}, 0)) + SUM(COALESCE(${resultadosMiembro.aciertosApuesta2}, 0)))::numeric
                / NULLIF(COUNT(${resultadosMiembro.aciertosApuesta1}) + COUNT(${resultadosMiembro.aciertosApuesta2}), 0)
            `,
            jornadasCalculadas: sql<number>`COUNT(DISTINCT ${resultadosMiembro.jornadaId})::int`,
        })
        .from(resultadosMiembro)
        .innerJoin(jornadas, eq(jornadas.id, resultadosMiembro.jornadaId))
        /* v8 ignore next -- @preserve */
        .where(condiciones.length > 0 ? and(...condiciones) : undefined);

    /* v8 ignore next -- @preserve */
    if (!row) throw new Error("No se pudieron calcular los agregados");


    return {
        sumaImporteEscalon: Number(row.sumaImporteEscalon),
        sumaPremios: Number(row.sumaPremios),
        sumaBote: Number(row.sumaBote),
        mediaAciertosMax: row.mediaAciertosMax === null ? null : Number(row.mediaAciertosMax),
        maxAciertos: row.maxAciertos,
        minAciertos: row.minAciertos,
        maxPremio: row.maxPremio === null ? null : Number(row.maxPremio),
        mediaAciertosAmbas: row.mediaAciertosAmbas === null ? null : Number(row.mediaAciertosAmbas),
        jornadasCalculadas: row.jornadasCalculadas,
    }
};




export interface AjustesBoteFiltros {
    temporadaId: string;
    hastaFecha?: string | undefined; // fecha <= hastaFecha OR es heredado
}

export async function sumaAjustesBote(filtros: AjustesBoteFiltros, tx: DbOrTx = db): Promise<number> {
    const condiciones: SQL[] = [eq(ajustesBote.temporadaId, filtros.temporadaId)];
    if (filtros.hastaFecha !== undefined) {
        // El bote heredado cuenta siempre, aunque su fecha (fechaInicio) sea posterior a la jornada.
        condiciones.push(
            sql`(${ajustesBote.fecha} <= ${filtros.hastaFecha} OR ${ajustesBote.origenTemporadaId} IS NOT NULL)`,
        );
    }
    const [row] = await tx
        .select({ total: sql<string>`COALESCE(SUM(${ajustesBote.importe}), 0)` })
        .from(ajustesBote)
        .where(and(...condiciones));
    /* v8 ignore next -- @preserve */
    return row ? Number(row.total) : 0;
}

// Bote de una temporada: sus ajustes (incluido el heredado) + el bote de todas sus jornadas calculadas.
// Única fuente de verdad: lo usan boteTotal (dashboard) y el bote heredado (temporadas.activate).
export async function boteTemporada(temporadaId: string, tx: DbOrTx = db): Promise<number> {
    const ajustes = await sumaAjustesBote({ temporadaId }, tx);
    const { sumaBote } = await agregados({ temporadaId }, tx);
    return Math.round((ajustes + sumaBote) * 100) / 100;
}

export async function usuariosConAciertos(temporadaId: string, aciertos: number, tx: DbOrTx = db): Promise<string[]> {
    const filas = await tx
        .selectDistinct({ usuarioId: resultadosMiembro.usuarioId })
        .from(resultadosMiembro)
        .innerJoin(jornadas, eq(jornadas.id, resultadosMiembro.jornadaId))
        .where(and(eq(jornadas.temporadaId, temporadaId), eq(resultadosMiembro.aciertosMax, aciertos)));
    return filas.map((f) => f.usuarioId);
}

// Última jornada de la temporada con cálculo ejecutado y número <= hastaNumeroJornada.
export async function ultimaJornadaCalculada(
    temporadaId: string,
    hastaNumeroJornada: number,
    tx: DbOrTx = db,
): Promise<{ numeroJornada: number; fecha: string } | undefined> {
    const [row] = await tx
        .selectDistinct({ numeroJornada: jornadas.numeroJornada, fecha: jornadas.fecha })
        .from(resultadosMiembro)
        .innerJoin(jornadas, eq(jornadas.id, resultadosMiembro.jornadaId))
        .where(and(eq(jornadas.temporadaId, temporadaId), lte(jornadas.numeroJornada, hastaNumeroJornada)))
        .orderBy(desc(jornadas.numeroJornada))
        .limit(1);
    return row;
}
