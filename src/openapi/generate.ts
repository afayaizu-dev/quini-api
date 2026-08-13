import { writeFileSync } from "node:fs";
import { createDocument } from "zod-openapi";
import "../modules/auth/auth.openapi.js";
import "../modules/invitations/invitations.openapi.js";
import { paths } from "./registry.js";
import { securitySchemes } from "./security-schemes.js";
import "../modules/temporadas/temporadas.openapi.js";




const document = createDocument({
    openapi: "3.1.0",
    info: {
        title: "quini-api",
        version: "1.0.0",
        description: "API REST autenticada para la gestión de una peña de quiniela.",
    },
    servers: [{ url: "/api/v1" }],
    tags: [
        { name: "auth", description: "Autenticación: login, tokens, Google." },
        { name: "invitaciones", description: "Alta cerrada por invitación." },
        { name: "temporadas", description: "Gestión de temporadas." },
    ],
    paths,
    components: { securitySchemes },
});

writeFileSync("openapi/openapi.json", JSON.stringify(document, null, 2) + "\n");

console.log("openapi/openapi.json generado.");
