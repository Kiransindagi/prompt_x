import { LLMAdapter, LLMGenerateParams } from "./base";
import { useSettingsStore } from "../store/settingsStore";
import { LLMRequestError, requestWithTimeout } from './request';

export const OpenAIAdapter: LLMAdapter = {
    name: "openai",

    async generate({ userPrompt, systemPrompt, temperature = 0.7, model }: LLMGenerateParams) {
        const storeState = useSettingsStore.getState();
        const apiKey = storeState.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY;

        if (!apiKey) {
            throw new LLMRequestError('OpenAI API key is not configured.', 'OpenAI');
        }

        try {
            let modelName = model || "gpt-4o";
            if (!model) {
                const preference = storeState.llmPreference;
                if (preference === 'OPENAI_MINI') {
                    modelName = "gpt-4o-mini";
                }
            }

            const response = await requestWithTimeout("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: "system", content: systemPrompt || "You are a helpful AI assistant." },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: temperature
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || "OpenAI API Error");
            }

            const data = await response.json();
            return data.choices[0].message.content || "";
        } catch (error: any) {
            console.error('[OpenAI] API Failed:', error);
            throw new LLMRequestError(error.message || 'OpenAI request failed.', 'OpenAI');
        }
    }
};
