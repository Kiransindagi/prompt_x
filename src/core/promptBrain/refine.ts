import { getLLMAdapter, LLMType } from "../../adapters";
import { useSettingsStore } from "../../store/settingsStore";

export async function refineResponse(currentText: string, instruction: string): Promise<string> {
    const preference = useSettingsStore.getState().llmPreference.toLowerCase();

    // Default to 'openai' if 'auto' is selected for now, or match the registry keys
    const adapterType = (preference === 'auto' ? 'openai' : preference) as LLMType;
    const adapter = getLLMAdapter(adapterType);

    const prompt = `Original Text:\n"${currentText}"\n\nRefinement Instruction: ${instruction}\n\nRewrite the text applying the instruction. Output ONLY the rewritten text.`;

    try {
        const result = await adapter.generate({
            userPrompt: prompt,
            systemPrompt: "You are an expert editor. Rewrite the text exactly as requested.",
            temperature: 0.7
        });
        return result;
    } catch (e) {
        console.error("Refine failed", e);
        return currentText; // Fallback
    }
}
