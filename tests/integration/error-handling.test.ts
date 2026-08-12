import { describe, expect, test } from "vitest";
import request from "supertest";
import { app } from "../helpers/auth.js";

describe("Manejo de errores", () => {
    test("cuerpo con datos inválidos (Zod) -> 400 VALIDATION_ERROR con detalles", async () => {
        const response = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "password", username: "alguien@test.local" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("VALIDATION_ERROR");
        expect(Array.isArray(response.body.details)).toBe(true);
    });

    test("JSON malformado en el body -> 400 VALIDATION_ERROR", async () => {
        const response = await request(app)
            .post("/api/v1/auth/token")
            .set("Content-Type", "application/json")
            .send("{ esto no es JSON válido");

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("VALIDATION_ERROR");
    });
});