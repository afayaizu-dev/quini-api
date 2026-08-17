import { NotFoundError } from "../../core/errors.js";
import * as dashboardRepository from "./dashboard.repository.js";
import * as temporadasService from "../temporadas/temporadas.service.js";
import * as jornadasService from "../jornadas/jornadas.service.js";
import * as usuariosService from "../usuarios/usuarios.service.js";
import * as pagosService from "../pagos/pagos.service.js";
import * as pagosRepository from "../pagos/pagos.repository.js";
import * as apuestasRepository from "../apuestas/apuestas.repository.js";
import * as calculosRepository from "../calculos/calculos.repository.js";
import type { ResultadoMiembroFila } from "../calculos/calculos.repository.js";
import type { DashboardMiembroQuery, DashboardJornadaQuery, DashboardTemporadaQuery } from "./dashboard.schemas.js";

interface AuthContext {
    userId: string;
    role: string;
}

function redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
}

function porcentaje(propias: number, total: number): number {
    if (total === 0) return 0;
    return redondear((propias / total) * 100);
}

function toLiquidacion(fila: ResultadoMiembroFila) {
    return {
        usuarioId: fila.usuarioId,
        aciertosApuesta1: fila.aciertosApuesta1,
        aciertosApuesta2: fila.aciertosApuesta2,
        aciertosMax: fila.aciertosMax,
        premioApuesta1: fila.premioApuesta1,
        premioApuesta2: fila.premioApuesta2,
        ranking: fila.ranking,
        escalon: fila.escalon,
        importeEscalon: fila.importeEscalon,
        costeApuestas: fila.costeApuestas,
        bote: fila.bote,
    };
}

export async function miembro(query: DashboardMiembroQuery, auth: AuthContext) {
    const temporadaActual = await temporadasService.resolveTemporada(query.temporada);
    const usuarioId = await usuariosService.resolveUsuarioObjetivo(auth, query.usuario);

    const agg = await dashboardRepository.agregados({ temporadaId: temporadaActual.id, usuarioId });
    const ingresosTotales = await pagosRepository.sumImportes(usuarioId);
    const credito = await pagosService.getCredito(usuarioId);
    const { total, propias } = await apuestasRepository.contarPorAutoria(usuarioId, temporadaActual.id);

    return {
        usuarioId,
        temporada: temporadaActual.codigo,
        pagosTotales: agg.sumaImporteEscalon,
        ingresosTotales,
        credito,
        mediaAciertos: agg.mediaAciertosMax,
        maxAciertos: agg.maxAciertos,
        minAciertos: agg.minAciertos,
        maxPremio: agg.maxPremio,
        premiosTotales: agg.sumaPremios,
        porcentajeApuestasPropias: porcentaje(propias, total),
    };
}

export async function jornada(query: DashboardJornadaQuery) {
    const temporadaActual = await temporadasService.resolveTemporada(query.temporada);
    const jornadaResuelta = await jornadasService.findByNumero(query.jornada, temporadaActual.codigo);

    const filas = await calculosRepository.findByJornada(jornadaResuelta.id);
    if (filas.length === 0) {
        throw new NotFoundError(`La jornada ${query.jornada} todavía no tiene un cálculo ejecutado.`);
    }

    const agg = await dashboardRepository.agregados({ jornadaId: jornadaResuelta.id });

    return {
        jornada: query.jornada,
        temporada: temporadaActual.codigo,
        pagosJornada: agg.sumaImporteEscalon,
        boteJornada: agg.sumaBote,
        premiosTotales: agg.sumaPremios,
        mediaAciertosDosApuestas: agg.mediaAciertosAmbas,
        mediaAciertosMaximos: agg.mediaAciertosMax,
        clasificacion: filas.map(toLiquidacion),
    };
}

export async function temporada(query: DashboardTemporadaQuery) {
    const temporadaResuelta = await temporadasService.resolveTemporada(query.temporada);
    const agg = await dashboardRepository.agregados({ temporadaId: temporadaResuelta.id });

    const usuariosMaxAciertos =
        agg.maxAciertos === null ? [] : await dashboardRepository.usuariosConAciertos(temporadaResuelta.id, agg.maxAciertos);
    const usuariosMinAciertos =
        agg.minAciertos === null ? [] : await dashboardRepository.usuariosConAciertos(temporadaResuelta.id, agg.minAciertos);

    return {
        temporada: temporadaResuelta.codigo,
        maxAciertos: agg.maxAciertos,
        usuariosMaxAciertos,
        minAciertos: agg.minAciertos,
        usuariosMinAciertos,
        premiosTotales: agg.sumaPremios,
        pagosTotales: agg.sumaImporteEscalon,
        boteTotal: agg.sumaBote,
        jornadasCalculadas: agg.jornadasCalculadas,
    };
}
