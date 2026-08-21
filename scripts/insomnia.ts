/**
 * Genera insomnia/quini-api.insomnia.yaml a partir de openapi/openapi.json.
 *
 * Sustituye al import manual en la app de Insomnia (docs/05-Insomnia.md §3) por dos razones:
 *
 * 1. El import deja cada petición protegida con `{{ bearerToken }}`, una variable que nunca
 *    se define — hay que corregirla a mano en las 51 peticiones. Aquí se emite ya apuntando
 *    a `{{ _.accessToken }}`, que sí existe en los entornos generados.
 * 2. Es determinista: los identificadores se derivan del método y la ruta, así que dos
 *    ejecuciones con el mismo contrato producen un fichero idéntico y el diff en git solo
 *    muestra los cambios reales.
 *
 * Uso: npm run insomnia:generate
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { stringify } from "yaml";

const SPEC_PATH = "openapi/openapi.json";
const OUT_PATH = "insomnia/quini-api.insomnia.yaml";

/** Fijo a propósito: si fuese Date.now(), cada ejecución cambiaría el fichero entero. */
const TS = 1786657243109;

const METHODS = ["get", "post", "put", "patch", "delete"] as const;
type Method = (typeof METHODS)[number];

interface Parameter {
  name: string;
  in: "path" | "query" | "header";
  required?: boolean;
  example?: unknown;
  schema?: { type?: string; format?: string };
}

interface MediaType {
  schema?: unknown;
  /** OpenAPI admite un ejemplo suelto... */
  example?: unknown;
  /** ...o varios con nombre. El contrato usa esto en POST /auth/token. */
  examples?: Record<string, { summary?: string; value?: unknown }>;
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  security?: unknown[];
  parameters?: Parameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, MediaType>;
  };
  "x-required-role"?: string;
}

interface OpenApiDocument {
  tags?: { name: string; description?: string }[];
  paths: Record<string, Partial<Record<Method, Operation>> & { parameters?: Parameter[] }>;
}

function id(prefix: string, seed: string, length = 32): string {
  return `${prefix}_${createHash("sha1").update(seed).digest("hex").slice(0, length)}`;
}

/** Insomnia usa `:param`, OpenAPI usa `{param}`. */
function toInsomniaPath(path: string): string {
  return path.replace(/\{([^}]+)\}/g, ":$1");
}

/** Primer ejemplo disponible, venga como `example` suelto o como `examples` con nombre. */
function mediaExample(media: MediaType | undefined): unknown {
  if (media?.example !== undefined) return media.example;
  const conNombre = Object.values(media?.examples ?? {});
  return conNombre[0]?.value;
}

function exampleValue(p: Parameter): string {
  if (p.example !== undefined) return String(p.example);
  return p.schema?.format ?? p.schema?.type ?? "string";
}

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf-8")) as OpenApiDocument;

const settings = {
  renderRequestBody: true,
  encodeUrl: true,
  followRedirects: "global",
  cookies: { send: true, store: true },
  rebuildPath: true,
};

function buildRequest(method: Method, path: string, op: Operation, sortKey: number): unknown {
  const seed = `${method} ${path}`;
  const soloAdmin = op["x-required-role"] === "admin";

  const descripcion = [soloAdmin ? "[Solo admin]" : "", (op.description ?? "").trim()]
    .filter(Boolean)
    .join(" ");

  const request: Record<string, unknown> = {
    url: `{{ _.base_url }}${toInsomniaPath(path)}`,
    name: op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`,
    meta: {
      id: id("req", seed),
      created: TS,
      modified: TS,
      isPrivate: false,
      ...(descripcion ? { description: descripcion } : {}),
      sortKey,
    },
    method: method.toUpperCase(),
  };

  const content = op.requestBody?.content ?? {};
  const [mimeType, media] = Object.entries(content)[0] ?? [];

  if (mimeType === "application/json") {
    request.body = {
      mimeType,
      text: JSON.stringify(mediaExample(media) ?? {}, null, 2),
    };
    request.headers = [{ name: "Content-Type", value: mimeType, disabled: false }];
  } else if (mimeType === "application/x-www-form-urlencoded") {
    const ejemplo = (mediaExample(media) ?? {}) as Record<string, unknown>;
    request.body = {
      mimeType,
      params: Object.entries(ejemplo).map(([name, value]) => ({
        name,
        value: String(value),
        disabled: false,
      })),
    };
    request.headers = [{ name: "Content-Type", value: mimeType, disabled: false }];
  }

  const query = (op.parameters ?? []).filter((p) => p.in === "query");
  if (query.length > 0) {
    request.parameters = query.map((p) => ({
      name: p.name,
      value: exampleValue(p),
      disabled: p.required !== true,
    }));
  }

  // La diferencia con el import de la app: el token apunta a una variable que sí existe.
  if (op.security !== undefined) {
    request.authentication = {
      type: "bearer",
      token: "{{ _.accessToken }}",
      prefix: "",
    };
  }

  request.settings = settings;
  return request;
}

// --- carpetas: una por tag de la spec, en el orden en que la spec las declara ---

const tags = spec.tags ?? [];
const porTag = new Map<string, unknown[]>(tags.map((t) => [t.name, []]));
const sinTag: unknown[] = [];
let orden = 0;

for (const [path, operaciones] of Object.entries(spec.paths)) {
  for (const method of METHODS) {
    const op = operaciones[method];
    if (!op) continue;

    const request = buildRequest(method, path, op, orden);
    orden += 1000;

    const tag = op.tags?.[0];
    const destino = tag !== undefined ? porTag.get(tag) : undefined;
    (destino ?? sinTag).push(request);
  }
}

if (sinTag.length > 0) {
  throw new Error(`${sinTag.length} operaciones sin un tag declarado en spec.tags.`);
}

const collection = tags
  .filter((t) => (porTag.get(t.name) ?? []).length > 0)
  .map((t, i) => ({
    name: t.name,
    meta: {
      id: id("fld", t.name),
      created: TS,
      modified: TS,
      sortKey: i * 1000,
      ...(t.description ? { description: t.description } : {}),
    },
    children: porTag.get(t.name),
  }));

// --- entornos: uno por rol, para poder comprobar los 403 cambiando de entorno ---
//
// Se usa un accessToken pegado a mano en vez del helper de OAuth2 de Insomnia a propósito:
// el helper cachea el token por carpeta y no lo renueva al cambiar de entorno
// (bug de Insomnia documentado en docs/05-Insomnia.md §4.1).

function subEntorno(name: string, data: Record<string, string>, i: number): unknown {
  return {
    name,
    meta: { id: id("env", name), created: TS, modified: TS, isPrivate: false, sortKey: i * 1000 },
    data,
  };
}

const environments = {
  name: "Base environment",
  meta: { id: id("env", "base"), created: TS, modified: TS, isPrivate: false },
  data: {
    base_url: "http://localhost:3000/api/v1",
    accessToken: "",
  },
  subEnvironments: [
    subEntorno("Local · admin", { base_url: "http://localhost:3000/api/v1", accessToken: "" }, 0),
    subEntorno("Local · user", { base_url: "http://localhost:3000/api/v1", accessToken: "" }, 1),
    subEntorno("Producción", { base_url: "https://api.quiniweb.com/api/v1", accessToken: "" }, 2),
  ],
};

const documento = {
  type: "spec.insomnia.rest/5.0",
  schema_version: "5.1",
  name: "quini-api 1.0.0",
  meta: {
    id: id("wrk", "quini-api"),
    created: TS,
    modified: TS,
    description:
      "Generado desde openapi/openapi.json con npm run insomnia:generate. No editar a mano.",
  },
  collection,
  cookieJar: {
    name: "Default Jar",
    meta: { id: id("jar", "default", 40), created: TS, modified: TS },
  },
  environments,
  spec: {
    contents: JSON.parse(readFileSync(SPEC_PATH, "utf-8")),
    meta: { id: id("spc", "quini-api"), created: TS, modified: TS },
  },
};

writeFileSync(OUT_PATH, stringify(documento, { lineWidth: 100 }));

const peticiones = collection.reduce((n, f) => n + (f.children?.length ?? 0), 0);
console.log(`${OUT_PATH} generado: ${peticiones} peticiones en ${collection.length} carpetas.`);
