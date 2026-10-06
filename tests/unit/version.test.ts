import { describe, expect, test } from "vitest";
import { resolveAppVersion } from "../../src/config/version.js";

describe("resolveAppVersion", () => {
    test("con tag de despliegue -> versión del tag sin la v", () => {
        expect(resolveAppVersion("v1.2.0", "1.0.0")).toBe("1.2.0");
    });

    test("tag ya sin v -> se usa tal cual", () => {
        expect(resolveAppVersion("1.3.1", "1.0.0")).toBe("1.3.1");
    });

    test("sin tag (undefined o vacío) -> versión de package.json", () => {
        expect(resolveAppVersion(undefined, "1.0.0")).toBe("1.0.0");
        expect(resolveAppVersion("", "1.0.0")).toBe("1.0.0");
    });
});
