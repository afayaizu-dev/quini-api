import { describe, expect, test } from "vitest";
import request from "supertest";
import { app } from "../helpers/auth.js";

describe("GET /health", () => {
    test("200 con status, versión y commit", async () => {
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("ok");
        expect(response.body.version).toMatch(/^\d+\.\d+\.\d+/);
        expect(response.body).toHaveProperty("commit");
        expect(typeof response.body.uptime).toBe("number");
    });

    test("/openapi.json publica la misma versión que /health", async () => {
        const health = await request(app).get("/health");
        const openapi = await request(app).get("/openapi.json");

        expect(openapi.status).toBe(200);
        expect(openapi.body.info.version).toBe(health.body.version);
    });
});
