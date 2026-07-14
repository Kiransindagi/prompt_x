import { runPromptPipeline } from "./promptBrain";
import { useOverlayStore } from "../store/overlayStore";
import { useUserStore } from "../store/userStore";
import { useSettingsStore } from "../store/settingsStore";
import { useModeStore } from "../store/modeStore";

// The Entry Point for UI -> Brain
export async function invokeBot(text: string) {
    console.log("⚡ invokeBot called with:", text);

    // 1. Gather Context (Control Knobs)
    // We access the raw state from stores (outside React components)
    const plan = useUserStore.getState().plan;
    const preference = useSettingsStore.getState().llmPreference;
    const activeMode = useModeStore.getState().activeMode;

    // 2. Set UI to Thinking
    useOverlayStore.getState().setThinking();

    // 3. Run Pipeline
    try {
        const result = await runPromptPipeline(text, plan, preference, activeMode);
        
        // 4. Update UI with Result
        useOverlayStore.getState().setExpanded(result.output.text, result.analysis);
        return result;
    } catch (error: any) {
        console.error("invokeBot error:", error);
        useOverlayStore.getState().setExpanded(`[System Error]\n\nFailed to process request: ${error.message}`);
        return null;
    }
}
