import type { ZodOpenApiPathsObject } from "zod-openapi";

export const paths: ZodOpenApiPathsObject = {};

export function registerPath(path: string, definition: ZodOpenApiPathsObject[string]): void {
    paths[path] = { ...paths[path], ...definition };
}