import { readFileSync } from "node:fs";
import path from "node:path";

export interface FilaCsv {
    [clave: string]: string;
}

function parsearLinea(linea: string): string[] {
    const campos: string[] = [];
    let actual = "";
    let entreComillas = false;

    for (let i = 0; i < linea.length; i++) {
        const c = linea[i];

        if (entreComillas) {
            if (c === '"') {
                if (linea[i + 1] === '"') {
                    actual += '"';
                    i++;
                } else {
                    entreComillas = false;
                }
            } else {
                actual += c;
            }
        } else if (c === '"') {
            entreComillas = true;
        } else if (c === ";") {
            campos.push(actual);
            actual = "";
        } else {
            actual += c;
        }
    }
    campos.push(actual);
    return campos;
}

export function parsearCsv(contenido: string): FilaCsv[] {
    const lineas = contenido.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lineas.length === 0) return [];

    const cabecera = parsearLinea(lineas[0] ?? "").map((c) => c.trim());
    return lineas.slice(1).map((linea) => {
        const valores = parsearLinea(linea);
        const fila: FilaCsv = {};
        cabecera.forEach((clave, i) => {
            fila[clave] = valores[i] ?? "";
        });
        return fila;
    });
}

export function leerCsv(nombreFichero: string): FilaCsv[] {
    const ruta = path.join(process.cwd(), "seed", nombreFichero);
    let contenido = readFileSync(ruta, "utf-8");
    if (contenido.charCodeAt(0) === 0xfeff) {
        contenido = contenido.slice(1);
    }
    return parsearCsv(contenido);
}


export function texto(valor: string | undefined): string {
    return (valor ?? "").trim();
}

export function textoOpcional(valor: string | undefined): string | undefined {
    const t = texto(valor);
    return t === "" ? undefined : t;
}

export function numero(valor: string | undefined): number {
    const t = texto(valor).replace(",", ".");
    const n = Number(t);
    if (Number.isNaN(n)) throw new Error(`Valor numérico inválido: "${valor}"`);
    return n;
}

export function booleano(valor: string | undefined): boolean {
    const t = texto(valor).toLowerCase();
    return t === "true" || t === "1" || t === "si" || t === "sí";
}
