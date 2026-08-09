import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../../core/errors.js";
import type { AccessTokenPayload } from "../auth/tokens.js";
import * as invitationsService from "./invitations.service.js";
import type { CreateInvitationInput } from "./invitations.schemas.js";

function requireAuthContext(req: Request): AccessTokenPayload {
    if (!req.auth) {
        throw new UnauthorizedError();
    }
    return req.auth;
}

export async function create(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateInvitationInput;
    const auth = requireAuthContext(req);

    const invitation = await invitationsService.create(body.email, body.role, auth.userId);

    res.status(201).json({
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        url: `${env.PUBLIC_APP_URL}/registro?token=${invitation.token}`,
    });
}

export async function validate(req: Request, res: Response): Promise<void> {
    const { token } = req.params as { token: string };
    const details = await invitationsService.validate(token);
    res.status(200).json(details);
}
