import { and, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { resultadosMiembro } from "../../db/schema/resultados_miembro.js";
import { jornadas } from "../../db/schema/jornadas.js";

export interface AgregadosFiltros {
    temporadaId?: string | undefined;
    jornadaId?: string | undefined;
    usuarioId?: string | undefined;
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




export async function usuariosConAciertos(temporadaId: string, aciertos: number, tx: DbOrTx = db): Promise<string[]> {
    const filas = await tx
        .selectDistinct({ usuarioId: resultadosMiembro.usuarioId })
        .from(resultadosMiembro)
        .innerJoin(jornadas, eq(jornadas.id, resultadosMiembro.jornadaId))
        .where(and(eq(jornadas.temporadaId, temporadaId), eq(resultadosMiembro.aciertosMax, aciertos)));
    return filas.map((f) => f.usuarioId);
}