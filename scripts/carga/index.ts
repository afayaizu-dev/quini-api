import { pool } from "../../src/db/index.js";
import { crearContexto, type Contexto, type ResumenModulo } from "./contexto.js";
import * as equipos from "./equipos.js";
import * as temporadas from "./temporadas.js";
import * as usuarios from "./usuarios.js";
import * as jornadas from "./jornadas.js";
import * as apuestas from "./apuestas.js";
import * as resultados from "./resultados.js"
import * as calculos from "./calculos.js";
import * as pagos from "./pagos.js";



function parseArgs(argv: string[]): Record<string, string | boolean> {
    const args: Record<string, string | boolean> = {};
    for (const arg of argv) {
        if (!arg.startsWith("--")) continue;
        const [key, value] = arg.slice(2).split("=");
        if (key) args[key] = value ?? true;
    }
    return args;
}


export interface ModuloCarga {
    nombre: string;
    cargar: (ctx: Contexto, opciones: { dryRun: boolean }) => Promise<ResumenModulo>;
}

// Se rellena en los pasos siguientes del plan: equipos, temporadas, usuarios, jornadas, apuestas, resultados.
const MODULOS: ModuloCarga[] = [
    { nombre: "equipos", cargar: equipos.cargar },
    { nombre: "temporadas", cargar: temporadas.cargar },
    { nombre: "usuarios", cargar: usuarios.cargar },
    { nombre: "jornadas", cargar: jornadas.cargar },
    { nombre: "apuestas", cargar: apuestas.cargar },
    { nombre: "resultados", cargar: resultados.cargar },
    { nombre: "calculos", cargar: calculos.cargar },
    { nombre: "pagos", cargar: pagos.cargar },
];

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const solo = typeof args.solo === "string" ? args.solo : undefined;
    const dryRun = args["dry-run"] === true;
    const calcular = args.calcular === true;

    const modulos = solo
        ? MODULOS.filter((m) => m.nombre === solo)
        : MODULOS.filter((m) => m.nombre !== "calculos" || calcular);

    if (modulos.length === 0) {
        console.error(solo ? `No existe el módulo de carga "${solo}".` : "No hay módulos de carga registrados todavía.");
        process.exitCode = 1;
        return;
    }

    const ctx = crearContexto();
    let huboErrores = false;

    for (const modulo of modulos) {
        console.log(`\n— ${modulo.nombre} —`);
        const resumen = await modulo.cargar(ctx, { dryRun });

        if (resumen.errores.length > 0) {
            huboErrores = true;
            console.error(`  ${resumen.errores.length} error(es):`);
            resumen.errores.forEach((e) => console.error(`    ${e}`));
        } else {
            console.log(`  creados: ${resumen.creados}, actualizados: ${resumen.actualizados}`);
        }
    }

    if (huboErrores) {
        console.error("\nCarga interrumpida: hay errores de validación.");
        process.exitCode = 1;
    } else {
        console.log("\nCarga completada sin errores.");
    }
}

main()
    .catch((err: unknown) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());