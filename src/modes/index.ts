import { CreativeMode } from "./creative";
import { DeveloperMode } from "./developer";
import { MarketingMode } from "./marketing";
import { CustomMode } from "../store/settingsStore";

export const MODE_REGISTRY: Record<string, typeof CreativeMode> = {
    creative: CreativeMode,
    developer: DeveloperMode,
    marketing: MarketingMode,
};

export const BUILTIN_MODES = {
    ...MODE_REGISTRY,
    concise: { name: 'concise', tone: 'direct', temperature: 0.2, verbosity: 'concise', systemPrompt: 'Rewrite with maximum clarity and minimum words. Preserve essential meaning and remove filler.' },
    academic: { name: 'academic', tone: 'formal', temperature: 0.3, verbosity: 'detailed', systemPrompt: 'Write with academic rigor, precise claims, and clear evidence boundaries. Never invent citations.' },
    email: { name: 'email', tone: 'professional', temperature: 0.4, verbosity: 'concise', systemPrompt: 'Write polished, context-aware professional email communication with a clear subject and appropriate closing when useful.' },
    agentic: { name: 'agentic', tone: 'structured', temperature: 0.3, verbosity: 'detailed', systemPrompt: 'Break complex requests into an actionable, ordered plan. State assumptions and dependencies explicitly.' },
};

export function getMode(name: string, customModes: CustomMode[] = []) {
    const custom = customModes.find((mode) => mode.name.toLowerCase() === name.toLowerCase());
    return custom || BUILTIN_MODES[name.toLowerCase() as keyof typeof BUILTIN_MODES] || CreativeMode;
}
