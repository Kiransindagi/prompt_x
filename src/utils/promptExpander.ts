import { getLLMAdapter, LLMType } from "../adapters";
import { getMode } from "../modes";

export const PROMPT_ENGINEER_SYSTEM_PROMPT = `You are a world-class, elite prompt engineer. 

Your objective is to take a simple, high-level user request (e.g. "make a login page" or "write ad copy") and expand it into a highly professional, detailed "prompt-engineer level" prompt.

You MUST customize the generated prompt to match the active Mode's characteristics:
- Tone
- Temperature / Creativity style
- Specialized syllabus instructions

Rules for the Generated Prompt:
1. Use advanced prompt engineering frameworks (e.g., Role-Objective-Constraints-Instructions).
2. Clearly define the AI's role, persona, and tone based on the selected mode.
3. List explicit technical, formatting, and quality constraints.
4. Include clear instructions and reasoning rules.
5. Provide a clear input section (e.g., "[INSERT YOUR TEXT HERE]") where users can supply their raw data.
6. Enforce a clean, structured output format.
7. Output ONLY the finished prompt in clean markdown. Do not include introductory or concluding conversational text.`;

export async function generateExpertPrompt(
    highLevelInput: string,
    activeMode: string,
    adapterType: LLMType
): Promise<{ prompt: string; latency: number }> {
    const startTime = Date.now();
    const adapter = getLLMAdapter(adapterType);
    const modeInfo = getMode(activeMode);

    const userPrompt = `
Selected Mode: ${modeInfo.name}
Mode system guidelines to incorporate: ${modeInfo.systemPrompt}
Mode tone: ${modeInfo.tone}
Mode temperature: ${modeInfo.temperature}

User's High-Level Request:
"${highLevelInput}"

Generate the ultimate, fully-expanded, prompt-engineer level prompt:
`;

    try {
        const expandedPrompt = await adapter.generate({
            systemPrompt: PROMPT_ENGINEER_SYSTEM_PROMPT,
            userPrompt: userPrompt,
            temperature: 0.8
        });

        return {
            prompt: expandedPrompt,
            latency: Date.now() - startTime
        };
    } catch (error: any) {
        console.error("Prompt expansion failed:", error);
        throw error;
    }
}
