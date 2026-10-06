import express, { type Application } from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { requestId } from "./middleware/request-id.js";
import { httpLogger } from "./middleware/http-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { NotFoundError } from "./core/errors.js";
import { router } from "./routes.js";
import cookieParser from "cookie-parser";
import { readFileSync } from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import { globalRateLimit } from "./middleware/rate-limit.js";
import { resolveAppVersion } from "./config/version.js";


const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf-8")) as {
    version: string;
};
const version = resolveAppVersion(env.APP_VERSION, packageJson.version);

export function createApp(): Application {
    const app = express();

    app.set("trust proxy", 1);
    app.disable("x-powered-by");

    app.use(helmet());
    app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
    app.use(globalRateLimit);
    app.use(requestId);
    app.use(httpLogger);
    app.use(express.json({ limit: "100kb" }));
    app.use(express.urlencoded({ extended: false, limit: "100kb" }));
    app.use(cookieParser(env.COOKIE_SECRET));


    app.get("/health", (_req, res) => {
        res.status(200).json({ status: "ok", version, commit: env.APP_COMMIT ?? null, uptime: process.uptime() });
    });

    app.use("/api/v1", router);
    const openapiDocument = JSON.parse(
        readFileSync(path.join(process.cwd(), "openapi/openapi.json"), "utf-8"),
    ) as { info: { version: string } };
    openapiDocument.info.version = version;

    app.get("/openapi.json", (_req, res) => {
        res.json(openapiDocument);
    });

    app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument, {
        swaggerOptions: { persistAuthorization: true },
    }));

    app.use((_req, _res, next) => {
        next(new NotFoundError("La ruta solicitada no existe."));
    });

    app.use(errorHandler);

    return app;
}