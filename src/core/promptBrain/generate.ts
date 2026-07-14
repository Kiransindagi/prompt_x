import { Strategy } from "./decide";
import { getLLMAdapter } from "../../adapters";

export interface GenerationResult {
    text: string;
    modelUsed: string;
    latency: number;
}

export async function generateRewrite(
    originalText: string,
    strategy: Strategy
): Promise<GenerationResult> {
    const startTime = Date.now();

    // 1. Get the correct adapter (The Brain doesn't care which one)
    const adapter = getLLMAdapter(strategy.llm);

    // 2. Assemble Structured Prompt (The Contract)
    let finalUserPrompt = originalText;

    if (strategy.outputSchema) {
        finalUserPrompt = `
You MUST follow this exact structure:

${JSON.stringify(strategy.outputSchema, null, 2)}

Rules:
- Use clear section headings matching the schema
- Do not omit any section
- Output in markdown
- Do not add extra sections unless necessary for clarity

User request:
"${originalText}"
`;
    }

    // 3. Call generate with the ENFORCED contract
    const text = await adapter.generate({
        systemPrompt: strategy.systemPrompt,
        userPrompt: finalUserPrompt,
        temperature: strategy.temperature
    });

    const latency = Date.now() - startTime;

    return {
        text,
        modelUsed: adapter.name,
        latency
    };
}
