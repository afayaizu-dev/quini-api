import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { validate } from "../../middleware/validate.js";
import { create, validate as validateInvitation } from "./invitations.controller.js";
import { CreateInvitationSchema } from "./invitations.schemas.js";
import { invitationRateLimit } from "../../middleware/rate-limit.js";

export const invitationsRouter = Router();

invitationsRouter.post("/", requireAuth, requireRole("admin"), validate({ body: CreateInvitationSchema }), create);
invitationsRouter.get("/:token/validar", invitationRateLimit, validateInvitation);