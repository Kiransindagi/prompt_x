import { LLMAdapter, LLMGenerateParams } from "./base";
import { useSettingsStore } from "../store/settingsStore";
import { LLMRequestError, requestWithTimeout } from './request';

export const ClaudeAdapter: LLMAdapter = {
    name: "claude",

    async generate({ userPrompt, systemPrompt, temperature = 0.7, model }: LLMGenerateParams) {
        const storeState = useSettingsStore.getState();
        const apiKey = storeState.claudeApiKey || import.meta.env.VITE_CLAUDE_API_KEY;

        if (!apiKey) {
            throw new LLMRequestError('Claude API key is not configured.', 'Claude');
        }

        try {
            let modelName = model || "claude-3-5-sonnet-20240620";
            if (!model) {
                const preference = storeState.llmPreference;
                if (preference === 'CLAUDE_OPUS') {
                    modelName = "claude-3-opus-20240229";
                }
            }

            // Note: Direct browser calls to Anthropic might fail CORS. 
            // In a production Tauri app, use the Rust HTTP plugin or a proxy.
            const response = await requestWithTimeout("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-dangerous-direct-browser-access": "true" // Enable browser access
                },
                body: JSON.stringify({
                    model: modelName,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: [
                        { role: "user", content: userPrompt }
                    ],
                    temperature: temperature
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || "Claude API Error");
            }

            const data = await response.json();
            return data.content[0].text || "";

        } catch (error: any) {
            console.error('[Claude] API Failed:', error);
            throw new LLMRequestError(error.message || 'Claude request failed.', 'Claude');
        }
    }
};
