export class LLMRequestError extends Error {
    constructor(message: string, public readonly provider: string) {
        super(message);
        this.name = 'LLMRequestError';
    }
}

export async function requestWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 45_000): Promise<Response> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
        if (controller.signal.aborted) throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
        throw error;
    } finally {
        window.clearTimeout(timer);
    }
}
