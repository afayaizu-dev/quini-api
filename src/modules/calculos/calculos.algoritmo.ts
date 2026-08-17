export interface ApuestaCalculo {
    id: string;
    usuarioId: string;
    numeroApuesta: 1 | 2;
    partidos: string[];
}

export interface PremiosCalculo {
    "10": number;
    "11": number;
    "12": number;
    "13": number;
    "14": number;
    "15": number;
}

export interface ResultadoCalculo {
    resultados: string[];
    premios: PremiosCalculo;
}

export interface EscalonPago {
    escalon: number;
    importe: number;
}

export interface LiquidacionMiembro {
    usuarioId: string;
    aciertosApuesta1: number | null;
    aciertosApuesta2: number | null;
    aciertosMax: number;
    premioApuesta1: number;
    premioApuesta2: number;
    ranking: number;
    escalon: number;
    importeEscalon: number;
    costeApuestas: number;
    bote: number;
}

const COSTE_APUESTAS = 1.5;
const ESCALON_MINIMO = 1;
const ESCALON_MAXIMO = 10;

function aEuros(centimos: number): number {
    return Math.round(centimos) / 100;
}

function aciertosDe(partidos: string[], resultados: string[]): number {
    let aciertos = 0;
    for (let i = 0; i < 14; i++) {
        if (partidos[i] === resultados[i]) aciertos++;
    }
    return aciertos;
}

function premioBaseCentimos(aciertos: number, premios: PremiosCalculo): number {
    if (aciertos < 10) return 0;
    const clave = String(aciertos) as keyof PremiosCalculo;
    return Math.round(premios[clave] * 100);
}

interface Agregado {
    usuarioId: string;
    aciertosApuesta1: number | null;
    aciertosApuesta2: number | null;
    aciertosMax: number;
    premioApuesta1Centimos: number;
    premioApuesta2Centimos: number;
}

export function calcularJornada(
    apuestas: ApuestaCalculo[],
    resultado: ResultadoCalculo,
    escalones: EscalonPago[],
): LiquidacionMiembro[] {
    const conAciertos = apuestas.map((apuesta) => ({
        ...apuesta,
        aciertos: aciertosDe(apuesta.partidos, resultado.resultados),
    }));

    const premio15Centimos = Math.round(resultado.premios["15"] * 100);
    const acertantes14 = conAciertos.filter((a) => a.aciertos === 14).sort((a, b) => (a.id < b.id ? -1 : 1));

    const parteCentimosPorApuesta = new Map<string, number>();
    if (acertantes14.length > 0) {
        const parteBase = Math.floor(premio15Centimos / acertantes14.length);
        const resto = premio15Centimos % acertantes14.length;
        acertantes14.forEach((apuesta, indice) => {
            parteCentimosPorApuesta.set(apuesta.id, parteBase + (indice < resto ? 1 : 0));
        });
    }

    const porUsuario = new Map<string, Agregado>();
    for (const apuesta of conAciertos) {
        const premioCentimos = premioBaseCentimos(apuesta.aciertos, resultado.premios) + (parteCentimosPorApuesta.get(apuesta.id) ?? 0);

        const existente: Agregado = porUsuario.get(apuesta.usuarioId) ?? {
            usuarioId: apuesta.usuarioId,
            aciertosApuesta1: null,
            aciertosApuesta2: null,
            aciertosMax: 0,
            premioApuesta1Centimos: 0,
            premioApuesta2Centimos: 0,
        };

        if (apuesta.numeroApuesta === 1) {
            existente.aciertosApuesta1 = apuesta.aciertos;
            existente.premioApuesta1Centimos = premioCentimos;
        } else {
            existente.aciertosApuesta2 = apuesta.aciertos;
            existente.premioApuesta2Centimos = premioCentimos;
        }
        existente.aciertosMax = Math.max(existente.aciertosMax, apuesta.aciertos);
        porUsuario.set(apuesta.usuarioId, existente);
    }

    const agregados = [...porUsuario.values()];

    const gruposAsc = [...new Set(agregados.map((a) => a.aciertosMax))].sort((a, b) => a - b);
    const totalGrupos = gruposAsc.length;
    const escalonPorGrupo = new Map<number, number>();
    const rankingPorGrupo = new Map<number, number>();
    gruposAsc.forEach((aciertosMax, j) => {
        escalonPorGrupo.set(aciertosMax, Math.max(ESCALON_MINIMO, ESCALON_MAXIMO - j));
        rankingPorGrupo.set(aciertosMax, totalGrupos - j);
    });

    const grupoMasAlto = gruposAsc[totalGrupos - 1];
    const miembrosGrupoMasAlto = agregados.filter((a) => a.aciertosMax === grupoMasAlto);

    const importesPorEscalon = new Map(escalones.map((e) => [e.escalon, e.importe]));

    return agregados.map((agregado) => {
        /* v8 ignore next -- @preserve */
        let escalon = escalonPorGrupo.get(agregado.aciertosMax) ?? ESCALON_MINIMO;
        if (agregado.aciertosMax === grupoMasAlto && miembrosGrupoMasAlto.length === 1) {
            escalon = ESCALON_MINIMO;
        }
        /* v8 ignore next -- @preserve */
        const ranking = rankingPorGrupo.get(agregado.aciertosMax) ?? totalGrupos;
        /* v8 ignore next -- @preserve */
        const importeEscalon = importesPorEscalon.get(escalon) ?? 0;
        const premioApuesta1 = aEuros(agregado.premioApuesta1Centimos);
        const premioApuesta2 = aEuros(agregado.premioApuesta2Centimos);
        const bote = Math.round((importeEscalon + premioApuesta1 + premioApuesta2 - COSTE_APUESTAS) * 100) / 100;

        return {
            usuarioId: agregado.usuarioId,
            aciertosApuesta1: agregado.aciertosApuesta1,
            aciertosApuesta2: agregado.aciertosApuesta2,
            aciertosMax: agregado.aciertosMax,
            premioApuesta1,
            premioApuesta2,
            ranking,
            escalon,
            importeEscalon,
            costeApuestas: COSTE_APUESTAS,
            bote,
        };
    });
}