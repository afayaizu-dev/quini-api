import { AsyncLocalStorage } from "node:async_hooks";

interface RequestStore {
    requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function getRequestId(): string | undefined {
    return requestContext.getStore()?.requestId;
}
