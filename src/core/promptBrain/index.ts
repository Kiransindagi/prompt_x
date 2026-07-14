import { analyzeInput, AnalysisResult } from "./analyze";
import { decideStrategy, Strategy, UserPlan } from "./decide";
import { generateRewrite, GenerationResult } from "./generate";
import { LLMPreference } from "../../store/settingsStore";

export interface PipelineOutput {
    analysis: AnalysisResult;
    strategy: Strategy;
    output: GenerationResult;
}

export async function runPromptPipeline(
    text: string,
    plan: UserPlan,
    preference: LLMPreference,
    activeMode: string
): Promise<PipelineOutput> {
    console.group("🧠 Prompt Brain Pipeline");

    // 1. Analyze
    const analysis = analyzeInput(text);
    console.log("[1] Analysis:", analysis);

    // 2. Decide (The Brain)
    const strategy = decideStrategy(analysis, plan, preference, activeMode);
    console.log("[2] Strategy:", strategy);

    // 3. Generate (The Execution)
    const output = await generateRewrite(text, strategy);
    console.log("[3] Output:", output);

    console.groupEnd();

    return {
        analysis,
        strategy,
        output
    };
}
