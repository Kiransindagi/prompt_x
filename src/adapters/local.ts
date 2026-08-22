import { LLMAdapter, LLMGenerateParams } from "./base";
import { useSettingsStore } from "../store/settingsStore";
import { LLMRequestError } from './request';

async function getFetch() {
    const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) {
        try {
            const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
            return tauriFetch;
        } catch (e) {
            console.warn('[Ollama] Failed to import Tauri HTTP plugin, using global fetch:', e);
        }
    }
    return fetch;
}

export const OllamaAdapter: LLMAdapter = {
    name: "ollama",

    async generate({ userPrompt, systemPrompt, temperature = 0.7 }: LLMGenerateParams) {
        const storeState = useSettingsStore.getState();
        const baseUrl = storeState.ollamaUrl || "http://localhost:11434";
        const model = storeState.ollamaModel || "llama3";

        const ollamaUrl = `${baseUrl.replace(/\/$/, '').replace(/\/api\/.*$/, '')}/api/generate`;

        try {
            const activeFetch = await getFetch();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60_000);
            const response = await activeFetch(ollamaUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                signal: controller.signal,
                body: JSON.stringify({
                    model: model,
                    prompt: userPrompt,
                    system: systemPrompt,
                    stream: false,
                    options: {
                        temperature: temperature
                    }
                })
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Ollama Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.response || "";

        } catch (error: any) {
            console.error('[Ollama] API Failed:', error);
            // Warn about CORS or connection
            const message = error?.name === 'AbortError'
                ? `Ollama did not respond within 60 seconds at ${ollamaUrl}.`
                : `${error.message || 'Connection failed.'} Check that Ollama is running and that the selected model is installed.`;
            throw new LLMRequestError(message, 'Ollama');
        }
    }
};
