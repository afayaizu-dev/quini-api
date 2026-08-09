export class AppError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details?: unknown;

    constructor(status: number, code: string, message: string, details?: unknown) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = this.constructor.name;
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: unknown) {
        super(400, "VALIDATION_ERROR", message, details);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "No autorizado") {
        super(401, "UNAUTHORIZED", message);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "No tienes permiso para esta acción") {
        super(403, "FORBIDDEN", message);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Recurso no encontrado") {
        super(404, "NOT_FOUND", message);
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(409, "CONFLICT", message);
    }
}

export class GoneError extends AppError {
    constructor(message: string) {
        super(410, "GONE", message);
    }
}