import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validate } from "../../middleware/validate.js";
import { create, findByJornada, findMias, replace, remove } from "./apuestas.controller.js";
import { CreateApuestaSchema, UpdateApuestaSchema, ApuestaNumeroParamSchema } from "./apuestas.schemas.js";
import { JornadaNumeroParamSchema, JornadaQuerySchema } from "../jornadas/jornadas.schemas.js";


export const apuestasRouter = Router();

apuestasRouter.post(
    "/:numeroJornada/apuestas",
    requireAuth,
    validate({ params: JornadaNumeroParamSchema, query: JornadaQuerySchema, body: CreateApuestaSchema }),
    create,
);

apuestasRouter.get(
    "/:numeroJornada/apuestas/mias",
    requireAuth,
    validate({ params: JornadaNumeroParamSchema, query: JornadaQuerySchema }),
    findMias,
);

apuestasRouter.get(
    "/:numeroJornada/apuestas",
    requireAuth,
    validate({ params: JornadaNumeroParamSchema, query: JornadaQuerySchema }),
    findByJornada,
);

apuestasRouter.put(
    "/:numeroJornada/apuestas/:numeroApuesta",
    requireAuth,
    validate({ params: ApuestaNumeroParamSchema, query: JornadaQuerySchema, body: UpdateApuestaSchema }),
    replace,
);

apuestasRouter.delete(
    "/:numeroJornada/apuestas/:numeroApuesta",
    requireAuth,
    validate({ params: ApuestaNumeroParamSchema, query: JornadaQuerySchema }),
    remove,
);