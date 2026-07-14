import { OpenAIAdapter } from "./openai";
import { ClaudeAdapter } from "./claude";
import { GeminiAdapter } from "./gemini";
import { OllamaAdapter } from "./local";
import { LLMAdapter } from "./base";

export const LLM_REGISTRY = {
    openai: OpenAIAdapter,
    openai_mini: OpenAIAdapter,
    claude: ClaudeAdapter,
    claude_opus: ClaudeAdapter,
    gemini: GeminiAdapter,
    gemini_flash: GeminiAdapter,
    ollama: OllamaAdapter
};

export type LLMType = keyof typeof LLM_REGISTRY;

export function getLLMAdapter(type: LLMType): LLMAdapter {
    return LLM_REGISTRY[type] || OllamaAdapter; // Default to Ollama
}
