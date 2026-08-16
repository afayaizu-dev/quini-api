import { describe, expect, test } from "vitest";
import { calcularJornada } from "../../src/modules/calculos/calculos.algoritmo.js";
import type { ApuestaCalculo, EscalonPago, PremiosCalculo } from "../../src/modules/calculos/calculos.algoritmo.js";

const RESULTADO = Array.from({ length: 14 }, () => "1");

function partidosConAciertos(aciertos: number): string[] {
    return Array.from({ length: 14 }, (_, i) => (i < aciertos ? "1" : "X"));
}

const PREMIOS_CERO: PremiosCalculo = { "10": 0, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0 };

const ESCALONES: EscalonPago[] = [
    { escalon: 10, importe: 2.5 },
    { escalon: 9, importe: 2.4 },
    { escalon: 8, importe: 2.3 },
    { escalon: 7, importe: 2.2 },
    { escalon: 6, importe: 2.1 },
    { escalon: 5, importe: 2.0 },
    { escalon: 4, importe: 1.9 },
    { escalon: 3, importe: 1.8 },
    { escalon: 2, importe: 1.7 },
    { escalon: 1, importe: 1.5 },
];

interface DatoMiembro {
    usuarioId: string;
    ap1: number;
    ap2?: number;
}

function apuestasDesde(datos: DatoMiembro[]): ApuestaCalculo[] {
    const apuestas: ApuestaCalculo[] = [];
    datos.forEach((d, i) => {
        apuestas.push({
            id: `a${String(i).padStart(2, "0")}-1`,
            usuarioId: d.usuarioId,
            numeroApuesta: 1,
            partidos: partidosConAciertos(d.ap1),
        });
        if (d.ap2 !== undefined) {
            apuestas.push({
                id: `a${String(i).padStart(2, "0")}-2`,
                usuarioId: d.usuarioId,
                numeroApuesta: 2,
                partidos: partidosConAciertos(d.ap2),
            });
        }
    });
    return apuestas;
}

function porUsuario(liquidaciones: ReturnType<typeof calcularJornada>) {
    return Object.fromEntries(liquidaciones.map((l) => [l.usuarioId, l]));
}

const EJEMPLO1: DatoMiembro[] = [
    { usuarioId: "user6", ap1: 5, ap2: 5 },
    { usuarioId: "user9", ap1: 6, ap2: 6 },
    { usuarioId: "user1", ap1: 3, ap2: 7 },
    { usuarioId: "user2", ap1: 5, ap2: 7 },
    { usuarioId: "user4", ap1: 4, ap2: 7 },
    { usuarioId: "user5", ap1: 6, ap2: 7 },
    { usuarioId: "user10", ap1: 6, ap2: 7 },
    { usuarioId: "user3", ap1: 8, ap2: 8 },
    { usuarioId: "user7", ap1: 6, ap2: 8 },
    { usuarioId: "user8", ap1: 8, ap2: 7 },
];

const EJEMPLO2: DatoMiembro[] = [
    { usuarioId: "user2", ap1: 4, ap2: 4 },
    { usuarioId: "user4", ap1: 5, ap2: 5 },
    { usuarioId: "user9", ap1: 5, ap2: 5 },
    { usuarioId: "user1", ap1: 6, ap2: 4 },
    { usuarioId: "user3", ap1: 7, ap2: 4 },
    { usuarioId: "user7", ap1: 7, ap2: 6 },
    { usuarioId: "user8", ap1: 6, ap2: 7 },
    { usuarioId: "user10", ap1: 7, ap2: 7 },
    { usuarioId: "user5", ap1: 8, ap2: 7 },
    { usuarioId: "user6", ap1: 8, ap2: 10 },
];

describe("calcularJornada — ejemplos del doc 07", () => {
    test("Ejemplo 1 recalculado: escalones 10/9/8/7, sin premios, bote total 8,00", () => {
        const liquidaciones = calcularJornada(apuestasDesde(EJEMPLO1), { resultados: RESULTADO, premios: PREMIOS_CERO }, ESCALONES);
        const u = porUsuario(liquidaciones);

        expect(u.user6?.escalon).toBe(10);
        expect(u.user6?.importeEscalon).toBe(2.5);
        expect(u.user6?.bote).toBeCloseTo(1.0);

        expect(u.user9?.escalon).toBe(9);
        expect(u.user9?.bote).toBeCloseTo(0.9);

        for (const nombre of ["user1", "user2", "user4", "user5", "user10"]) {
            expect(u[nombre]?.escalon).toBe(8);
            expect(u[nombre]?.importeEscalon).toBe(2.3);
            expect(u[nombre]?.bote).toBeCloseTo(0.8);
        }

        for (const nombre of ["user3", "user7", "user8"]) {
            expect(u[nombre]?.escalon).toBe(7);
            expect(u[nombre]?.importeEscalon).toBe(2.2);
            expect(u[nombre]?.bote).toBeCloseTo(0.7);
        }

        const boteTotal = liquidaciones.reduce((acc, l) => acc + l.bote, 0);
        expect(Math.round(boteTotal * 100) / 100).toBe(8.0);
    });

    test("Ejemplo 2: escalones idénticos a la tabla del doc 07, bote total 17,49", () => {
        const premios = { ...PREMIOS_CERO, "10": 10.49 };
        const liquidaciones = calcularJornada(apuestasDesde(EJEMPLO2), { resultados: RESULTADO, premios }, ESCALONES);
        const u = porUsuario(liquidaciones);

        expect(u.user2?.escalon).toBe(10);
        expect(u.user2?.bote).toBeCloseTo(1.0);

        for (const nombre of ["user4", "user9"]) {
            expect(u[nombre]?.escalon).toBe(9);
            expect(u[nombre]?.bote).toBeCloseTo(0.9);
        }

        expect(u.user1?.escalon).toBe(8);
        expect(u.user1?.bote).toBeCloseTo(0.8);

        for (const nombre of ["user3", "user7", "user8", "user10"]) {
            expect(u[nombre]?.escalon).toBe(7);
            expect(u[nombre]?.bote).toBeCloseTo(0.7);
        }

        expect(u.user5?.escalon).toBe(6);
        expect(u.user5?.bote).toBeCloseTo(0.6);

        expect(u.user6?.escalon).toBe(1);
        expect(u.user6?.importeEscalon).toBe(1.5);
        expect(u.user6?.premioApuesta2).toBe(10.49);
        expect(u.user6?.bote).toBeCloseTo(10.49);

        const boteTotal = liquidaciones.reduce((acc, l) => acc + l.bote, 0);
        expect(Math.round(boteTotal * 100) / 100).toBe(17.49);
    });
});

describe("calcularJornada — casos borde", () => {
    test("todos los miembros con los mismos aciertos -> todos al escalón 10", () => {
        const datos = [
            { usuarioId: "u1", ap1: 5 },
            { usuarioId: "u2", ap1: 5 },
            { usuarioId: "u3", ap1: 5 },
        ];
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios: PREMIOS_CERO }, ESCALONES);
        expect(liquidaciones.every((l) => l.escalon === 10)).toBe(true);
    });

    test("máximo alcanzado por un solo miembro -> ese miembro al escalón 1", () => {
        const datos = [
            { usuarioId: "top", ap1: 8 },
            { usuarioId: "resto1", ap1: 5 },
            { usuarioId: "resto2", ap1: 5 },
        ];
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios: PREMIOS_CERO }, ESCALONES);
        const u = porUsuario(liquidaciones);
        expect(u.top?.escalon).toBe(1);
        expect(u.resto1?.escalon).toBe(10);
    });

    test("máximo compartido por dos miembros -> no se aplica la excepción", () => {
        const datos = [
            { usuarioId: "topA", ap1: 8 },
            { usuarioId: "topB", ap1: 8 },
            { usuarioId: "resto", ap1: 5 },
        ];
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios: PREMIOS_CERO }, ESCALONES);
        const u = porUsuario(liquidaciones);
        expect(u.topA?.escalon).toBe(9);
        expect(u.topB?.escalon).toBe(9);
    });

    test("apuesta con 12 aciertos -> cobra premio_cat_12", () => {
        const datos = [{ usuarioId: "u1", ap1: 12 }];
        const premios = { ...PREMIOS_CERO, "12": 6.5 };
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios }, ESCALONES);
        expect(liquidaciones[0]?.premioApuesta1).toBe(6.5);
    });

    test("apuesta con 9 aciertos -> premio 0", () => {
        const datos = [{ usuarioId: "u1", ap1: 9 }];
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios: PREMIOS_CERO }, ESCALONES);
        expect(liquidaciones[0]?.premioApuesta1).toBe(0);
    });

    test("categoría 15 con 3 apuestas de 14 aciertos -> reparto a partes iguales, resto determinista", () => {
        const datos = [
            { usuarioId: "u1", ap1: 14 },
            { usuarioId: "u2", ap1: 14 },
            { usuarioId: "u3", ap1: 14 },
        ];
        const premios = { ...PREMIOS_CERO, "15": 1.0 };
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios }, ESCALONES);
        const u = porUsuario(liquidaciones);
        expect(u.u1?.premioApuesta1).toBe(0.34);
        expect(u.u2?.premioApuesta1).toBe(0.33);
        expect(u.u3?.premioApuesta1).toBe(0.33);
    });

    test("categoría 15 con las 2 apuestas de un mismo miembro a 14 -> cobra 2 partes", () => {
        const datos = [{ usuarioId: "u1", ap1: 14, ap2: 14 }];
        const premios = { ...PREMIOS_CERO, "15": 2.0 };
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios }, ESCALONES);
        expect(liquidaciones[0]?.premioApuesta1).toBe(1.0);
        expect(liquidaciones[0]?.premioApuesta2).toBe(1.0);
    });

    test("categoría 15 sin acertantes de 14 -> no se reparte nada", () => {
        const datos = [{ usuarioId: "u1", ap1: 10 }];
        const premios = { ...PREMIOS_CERO, "10": 5, "15": 100 };
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios }, ESCALONES);
        expect(liquidaciones[0]?.premioApuesta1).toBe(5);
    });

    test("miembro con una sola apuesta -> aciertos_apuesta_2 = null, entra en el ranking", () => {
        const datos = [
            { usuarioId: "solo", ap1: 7 },
            { usuarioId: "otro", ap1: 3 },
        ];
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios: PREMIOS_CERO }, ESCALONES);
        const u = porUsuario(liquidaciones);
        expect(u.solo?.aciertosApuesta2).toBeNull();
        expect(u.solo?.ranking).toBe(1);
    });

    test("11 grupos distintos -> escalón mínimo 1 (clamp), no 0 ni negativo", () => {
        const datos = Array.from({ length: 11 }, (_, i) => ({ usuarioId: `u${i}`, ap1: i }));
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios: PREMIOS_CERO }, ESCALONES);
        expect(liquidaciones.every((l) => l.escalon >= 1)).toBe(true);
        const segundoMasAlto = liquidaciones.find((l) => l.aciertosMax === 9);
        expect(segundoMasAlto?.escalon).toBe(1);
    });

    test("apuesta con 14 aciertos (el pleno no cuenta, N4) -> aciertos = 14, no 15", () => {
        const datos = [{ usuarioId: "u1", ap1: 14 }];
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios: PREMIOS_CERO }, ESCALONES);
        expect(liquidaciones[0]?.aciertosApuesta1).toBe(14);
    });

    test("miembro sin apuestas -> fuera del ranking, sin cargo", () => {
        const datos = [{ usuarioId: "conApuesta", ap1: 5 }];
        const liquidaciones = calcularJornada(apuestasDesde(datos), { resultados: RESULTADO, premios: PREMIOS_CERO }, ESCALONES);
        expect(liquidaciones).toHaveLength(1);
        expect(liquidaciones.some((l) => l.usuarioId === "sinApuestas")).toBe(false);
    });
});