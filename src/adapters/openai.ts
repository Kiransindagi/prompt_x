import { LLMAdapter, LLMGenerateParams } from "./base";
import { useSettingsStore } from "../store/settingsStore";

export const OpenAIAdapter: LLMAdapter = {
    name: "openai",

    async generate({ userPrompt, systemPrompt, temperature = 0.7, model }: LLMGenerateParams) {
        const storeState = useSettingsStore.getState();
        const apiKey = storeState.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY;

        if (!apiKey) {
            console.warn('[OpenAI] No API Key found. Returning mock.');
            // Fallback Mock (Keep existing for demo purposes if no key)
            if (userPrompt.toLowerCase().includes('login page')) {
                return `Design a secure login page with the following constraints:\n\n1. Tech Stack\n- React (TypeScript)\n- Tailwind CSS\n- Controlled form inputs\n\n2. Security Requirements\n- Client-side validation\n- Password masking\n- CSRF-safe submission pattern\n\n3. Architecture\n- Separate UI and auth logic\n- Typed API contract\n- Error boundary handling\n\n4. Deliverables\n- Component structure\n- Example code snippet\n- Explanation of decisions`;
            }
            return `[Mock] Configure OpenAI API Key in Settings to see real AI magic!\n\nRe-engineered Prompt: ${userPrompt}`;
        }

        try {
            let modelName = model || "gpt-4o";
            if (!model) {
                const preference = storeState.llmPreference;
                if (preference === 'OPENAI_MINI') {
                    modelName = "gpt-4o-mini";
                }
            }

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
            return `[Error] Failed to call OpenAI: ${error.message}`;
        }
    }
};
