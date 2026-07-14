import { LLMAdapter, LLMGenerateParams } from "./base";
import { useSettingsStore } from "../store/settingsStore";

export const GeminiAdapter: LLMAdapter = {
    name: "gemini",

    async generate({ userPrompt, systemPrompt, temperature = 0.7, model }: LLMGenerateParams) {
        const storeState = useSettingsStore.getState();
        const apiKey = storeState.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            return `[Mock] Configure Gemini API Key in Settings to see real Gemini magic!\n\nExpanded Prompt: ${userPrompt}`;
        }

        // 1. Normalize model string to ensure it is valid for Gemini API
        let modelName = "gemini-2.5-flash";
        if (model) {
            const lowerModel = model.toLowerCase();
            if (lowerModel.includes("1.5-pro") || lowerModel.includes("pro")) {
                modelName = "gemini-1.5-pro";
            } else if (lowerModel.includes("1.5-flash")) {
                modelName = "gemini-1.5-flash";
            } else if (lowerModel.includes("2.0-flash")) {
                modelName = "gemini-2.0-flash";
            } else if (lowerModel.includes("2.5-flash")) {
                modelName = "gemini-2.5-flash";
            } else if (model !== "gemini" && model !== "gemini_flash") {
                modelName = model;
            }
        }

        // 2. Define fallback candidates in sequence if the primary model is overloaded
        const candidateModels = [modelName];
        if (modelName === "gemini-2.5-flash") {
            candidateModels.push("gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro");
        } else if (modelName === "gemini-2.0-flash") {
            candidateModels.push("gemini-2.5-flash", "gemini-1.5-flash");
        } else if (modelName === "gemini-1.5-flash") {
            candidateModels.push("gemini-2.0-flash", "gemini-2.5-flash");
        } else if (modelName === "gemini-1.5-pro") {
            candidateModels.push("gemini-2.5-flash", "gemini-2.0-flash");
        }

        let lastError: any = null;

        // 3. Attempt requests with candidates in loop
        for (const currentModel of candidateModels) {
            try {
                console.log(`[Gemini] Attempting generation with model: ${currentModel}`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: "user",
                                parts: [{ text: (systemPrompt ? systemPrompt + "\n\n" : "") + userPrompt }]
                            }
                        ],
                        generationConfig: {
                            temperature: temperature
                        }
                    })
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    const errMsg = err.error?.message || `HTTP Error ${response.status}`;
                    const errStatus = err.error?.status || "";

                    // If transient/overloaded/rate-limited, try the next fallback model
                    if (
                        response.status === 429 ||
                        response.status === 503 ||
                        response.status === 404 || // Sometimes a newer/older model isn't enabled on the specific key
                        errMsg.toLowerCase().includes("demand") ||
                        errMsg.toLowerCase().includes("exhausted") ||
                        errMsg.toLowerCase().includes("overload") ||
                        errMsg.toLowerCase().includes("limit") ||
                        errStatus === "RESOURCE_EXHAUSTED"
                    ) {
                        console.warn(`[Gemini] Model ${currentModel} failed/overloaded: ${errMsg}. Retrying next model...`);
                        lastError = new Error(errMsg);
                        continue;
                    } else {
                        // For API key failures or formatting issues, throw immediately
                        throw new Error(errMsg);
                    }
                }

                const data = await response.json();
                if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    throw new Error("Invalid response format received from Gemini API");
                }
                
                console.log(`[Gemini] Successfully generated content using model: ${currentModel}`);
                return data.candidates[0].content.parts[0].text;

            } catch (error: any) {
                console.error(`[Gemini] Attempt failed for ${currentModel}:`, error);
                lastError = error;
                // If it is the last model in the candidates list, propagate the error
                if (currentModel === candidateModels[candidateModels.length - 1]) {
                    break;
                }
            }
        }

        return `[Error] Failed to call Gemini: ${lastError?.message || "All fallback models exhausted"}`;
    }
};
