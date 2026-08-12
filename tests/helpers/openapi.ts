import { readFileSync } from "node:fs";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsPkg from "ajv-formats";


const openapiDocument = JSON.parse(
    readFileSync(path.join(process.cwd(), "openapi/openapi.json"), "utf-8"),
);


const addFormats = addFormatsPkg as unknown as (ajv: Ajv2020) => void;
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);

const DOCUMENT_ID = "quini-api-openapi";
ajv.addSchema(openapiDocument, DOCUMENT_ID);

function escapeJsonPointerSegment(segment: string): string {
    return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

interface ExpectMatchesOpenApiSchemaOptions {
    path: string;
    method: "get" | "post" | "patch" | "put" | "delete";
    status: number;
    body: unknown;
}

export function expectMatchesOpenApiSchema({ path: routePath, method, status, body }: ExpectMatchesOpenApiSchemaOptions): void {
    const pointer = `/paths/${escapeJsonPointerSegment(routePath)}/${method}/responses/${status}/content/application~1json/schema`;

    const validate = ajv.compile({ $ref: `${DOCUMENT_ID}#${pointer}` });
    const valid = validate(body);

    if (!valid) {
        throw new Error(
            `La respuesta no cumple el schema OpenAPI de ${method.toUpperCase()} ${routePath} (${status}):\n` +
            JSON.stringify(validate.errors, null, 2),
        );
    }
}