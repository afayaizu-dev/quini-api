import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";

export const router = Router();

router.use("/auth", authRouter);