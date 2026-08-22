import { AnalysisResult } from "./analyze";
import { getMode } from "../../modes";
import { LLMType } from "../../adapters";
import { OutputSchema, LOGIN_PAGE_SCHEMA, GENERAL_SCHEMA } from "./structure";

export interface Strategy {
    llm: LLMType;
    systemPrompt: string;
    temperature: number;
    // Level 3-5 Metadata
    reasoningDepth: 'shallow' | 'structured' | 'deep';
    outputFormat: 'text' | 'markdown' | 'code' | 'actionable_guidance';
    safetyLevel: 'standard' | 'strict';
    outputSchema?: OutputSchema;
}

import { LLMPreference } from "../../store/settingsStore";
import { useSettingsStore } from '../../store/settingsStore';


// 🔥 MASTER SYSTEM PROMPT (Internal – NEVER shown)
const MASTER_SYSTEM_PROMPT = `You are an elite prompt engineer embedded inside a professional AI product.
You must:
- Infer user intent even from vague input
- Resolve ambiguity intelligently
- Apply best-practice prompt engineering techniques implicitly
- Optimize for clarity, scalability, correctness, and real-world use
- Never expose internal reasoning, syllabus, or techniques
- Produce outputs that a senior professional would expect

Constraints:
- No fluff
- No hallucination
- No unnecessary verbosity
- Prefer structured, actionable results
- STRICT: Do NOT output raw JSON code blocks or markdown JSON code fences unless explicitly requested.
- STRICT: Do NOT use markdown heading symbols (#, ##, ###). Instead, use UPPERCASE lines, elegant indentation, or clean dividers (like ---) for sections to make it extremely readable and distraction-free.`;

export function decideStrategy(
    analysis: AnalysisResult,
    preference: LLMPreference,
    activeModeName: string
): Strategy {

    // 1. Resolve LLM based on Plan and Preference
    let llm: LLMType = 'ollama';

    if (preference && preference !== 'AUTO') {
        llm = preference.toLowerCase() as LLMType;
    } else {
        llm = resolveAutoLLM(analysis);
    }

    // 2. Resolve Structure Schema (Level 9)
    let selectedSchema: OutputSchema | undefined;

    // Check intent from analysis to pick a schema
    if (analysis.intent === 'coding_ui') {
        selectedSchema = LOGIN_PAGE_SCHEMA;
    } else if (analysis.intent === 'coding_logic') {
        // Fallback or specific schema
        selectedSchema = GENERAL_SCHEMA;
    }
    // We can add more specific schemas here map to intent

    // 3. Apply Mode Settings & Syllabus Rules
    const mode = getMode(activeModeName, useSettingsStore.getState().customModes);

    // Level 4: Mode Profile is applied via 'mode' object, but we wrap it in Master Prompt
    // We append the specific mode instruction to the Master Prompt
    const finalSystemPrompt = `${MASTER_SYSTEM_PROMPT}\n\n[Active Mode: ${mode.name}]\n${mode.systemPrompt}`;

    return {
        llm,
        systemPrompt: finalSystemPrompt,
        temperature: mode.temperature,
        reasoningDepth: analysis.complexity === 'high' ? 'deep' : 'structured',
        outputFormat: analysis.intent.includes('coding') ? 'actionable_guidance' : 'text',
        safetyLevel: 'standard',
        outputSchema: selectedSchema
    };
}

function resolveAutoLLM(_analysis: AnalysisResult): LLMType {
    const settings = useSettingsStore.getState();
    if (settings.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY) {
        return 'gemini';
    }
    if (settings.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY) {
        return 'openai';
    }
    if (settings.claudeApiKey || import.meta.env.VITE_CLAUDE_API_KEY) {
        return 'claude';
    }
    return 'ollama';
}
