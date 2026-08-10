import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validate } from "../../middleware/validate.js";
import { logout, me, revoke, token, register, googleAuthorize, googleCallback, googleIdToken } from "./auth.controller.js";
import { RevokeRequestSchema, RegisterRequestSchema, TokenRequestSchema, GoogleIdTokenRequestSchema } from "./auth.schemas.js";
import { authRateLimit } from "../../middleware/rate-limit.js";

export const authRouter = Router();

authRouter.post("/token", authRateLimit, validate({ body: TokenRequestSchema }), token);
authRouter.post("/revoke", requireAuth, validate({ body: RevokeRequestSchema }), revoke);
authRouter.post("/logout", requireAuth, logout);
authRouter.get("/me", requireAuth, me);
authRouter.post("/register", authRateLimit, validate({ body: RegisterRequestSchema }), register);


authRouter.get("/google", googleAuthorize);
authRouter.get("/google/callback", authRateLimit, googleCallback);
authRouter.post("/google/id-token", authRateLimit, validate({ body: GoogleIdTokenRequestSchema }), googleIdToken);