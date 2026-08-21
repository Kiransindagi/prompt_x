import { runPromptPipeline } from "./promptBrain";
import { useOverlayStore } from "../store/overlayStore";
import { useUserStore } from "../store/userStore";
import { useSettingsStore } from "../store/settingsStore";
import { useModeStore } from "../store/modeStore";
import { useHistoryStore } from '../store/historyStore';

// The Entry Point for UI -> Brain
export async function invokeBot(text: string, action: 'rewrite' | 'shorten' | 'expand' = 'rewrite') {
    console.log("⚡ invokeBot called with:", text);

    // 1. Gather Context (Control Knobs)
    // We access the raw state from stores (outside React components)
    const plan = useUserStore.getState().plan;
    const preference = useSettingsStore.getState().llmPreference;
    const activeMode = useModeStore.getState().activeMode;

    const requestId = useOverlayStore.getState().requestId;

    // 2. Run Pipeline
    try {
        const actionInstruction = action === 'shorten'
            ? 'Rewrite the following text as a concise version that preserves all essential meaning:\n\n'
            : action === 'expand'
                ? 'Expand the following text with useful detail, examples, and context while preserving its intent:\n\n'
                : '';
        const result = await runPromptPipeline(actionInstruction + text, plan, preference, activeMode);
        
        // 3. Update UI with Result only if it is still the active request.
        useOverlayStore.getState().setExpanded(result.output.text, result.analysis, requestId);
        const settings = useSettingsStore.getState();
        if (settings.saveHistory) {
            const history = useHistoryStore.getState();
            if (settings.autoDeleteHistory) history.pruneOlderThan(30);
            history.add({ mode: activeMode, original: text, ai: result.output.text, model: result.output.modelUsed });
            settings.updateStats({ optimizedRequests: settings.stats.optimizedRequests + 1 });
        }
        return result;
    } catch (error: any) {
        console.error("invokeBot error:", error);
        useOverlayStore.getState().setExpanded(`[System Error]\n\nFailed to process request: ${error.message}`, undefined, requestId);
        return null;
    }
}
