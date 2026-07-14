export interface LLMGenerateParams {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    model?: string;
}

export interface LLMAdapter {
    name: string;
    generate(params: LLMGenerateParams): Promise<string>;
}
