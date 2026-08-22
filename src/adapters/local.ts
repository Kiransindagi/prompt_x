import { LLMAdapter, LLMGenerateParams } from "./base";
import { useSettingsStore } from "../store/settingsStore";
import { LLMRequestError } from './request';

export const OllamaAdapter: LLMAdapter = {
    name: "ollama",

    async generate({ userPrompt, systemPrompt, temperature = 0.7 }: LLMGenerateParams) {
        const storeState = useSettingsStore.getState();
        const baseUrl = storeState.ollamaUrl || "http://localhost:11434";
        const model = storeState.ollamaModel || "llama3";

        const ollamaUrl = `${baseUrl.replace(/\/$/, '').replace(/\/api\/.*$/, '')}/api/generate`;

        try {
            if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
                const { invoke } = await import('@tauri-apps/api/core');
                return await invoke<string>('ollama_generate', { baseUrl, model, prompt: userPrompt, system: systemPrompt, temperature });
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60_000);
            const response = await fetch(ollamaUrl, {
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
