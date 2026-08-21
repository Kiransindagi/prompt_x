import { getLLMAdapter, LLMType } from "../../adapters";
import { useSettingsStore } from "../../store/settingsStore";
import { analyzeInput } from './analyze';
import { decideStrategy } from './decide';
import { useUserStore } from '../../store/userStore';
import { useModeStore } from '../../store/modeStore';

export async function refineResponse(currentText: string, instruction: string): Promise<string> {
    const settings = useSettingsStore.getState();
    const strategy = decideStrategy(analyzeInput(currentText), useUserStore.getState().plan, settings.llmPreference, useModeStore.getState().activeMode);
    const adapter = getLLMAdapter(strategy.llm);

    const prompt = `Original Text:\n"${currentText}"\n\nRefinement Instruction: ${instruction}\n\nRewrite the text applying the instruction. Output ONLY the rewritten text.`;

    try {
        const result = await adapter.generate({
            userPrompt: prompt,
            systemPrompt: "You are an expert editor. Rewrite the text exactly as requested.",
            temperature: strategy.temperature
        });
        return result;
    } catch (e) {
        console.error("Refine failed", e);
        return currentText; // Fallback
    }
}
