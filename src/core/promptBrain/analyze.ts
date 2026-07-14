export interface AnalysisResult {
    intent: 'coding_ui' | 'coding_logic' | 'marketing' | 'email' | 'general' | 'creative';
    taskType: 'generation' | 'refinement' | 'completion' | 'explanation';
    complexity: 'low' | 'medium' | 'high';
    ambiguity: 'low' | 'medium' | 'high';
    missingContext: string[];
    expectedOutput: string;
    clarityScore: number;
    tone: 'formal' | 'casual' | 'neutral' | 'urgent';
    length: 'short' | 'medium' | 'long';
}

export function analyzeInput(text: string): AnalysisResult {
    const lowerText = text.toLowerCase();
    const words = text.split(/\s+/).length;

    // Level 0: Mental Model (Intent > Words)
    let intent: AnalysisResult['intent'] = 'general';
    let missingContext: string[] = [];

    // Coding Detection
    if (lowerText.includes('page') || lowerText.includes('ui') || lowerText.includes('component') || lowerText.includes('button') || lowerText.includes('form')) {
        intent = 'coding_ui';
        if (!lowerText.includes('react') && !lowerText.includes('vue') && !lowerText.includes('html')) missingContext.push('framework');
        if (!lowerText.includes('tailwind') && !lowerText.includes('css')) missingContext.push('styling');
    } else if (lowerText.includes('function') || lowerText.includes('api') || lowerText.includes('logic') || lowerText.includes('algo')) {
        intent = 'coding_logic';
        if (!lowerText.includes('language') && !lowerText.includes('python') && !lowerText.includes('ts')) missingContext.push('language');
    }
    // Marketing/Writing
    else if (lowerText.includes('ad') || lowerText.includes('copy') || lowerText.includes('sell')) {
        intent = 'marketing';
        missingContext.push('target audience', 'key benefits');
    }
    else if (lowerText.includes('email') || lowerText.includes('reply')) {
        intent = 'email';
    }

    // Level 1: Task Classification
    let taskType: AnalysisResult['taskType'] = 'generation';
    if (lowerText.startsWith('fix') || lowerText.includes('debug')) taskType = 'refinement';
    else if (lowerText.includes('explain') || lowerText.includes('how')) taskType = 'explanation';

    // Level 2: Ambiguity & Complexity
    let ambiguity: AnalysisResult['ambiguity'] = 'low';
    if (words < 5 && taskType === 'generation') ambiguity = 'high'; // "make login page" -> Very ambiguous
    else if (missingContext.length > 0) ambiguity = 'medium';

    let complexity: AnalysisResult['complexity'] = 'low';
    if (intent.includes('coding')) complexity = 'medium';
    if (words > 50 || missingContext.length > 2) complexity = 'high';

    return {
        intent,
        taskType,
        complexity,
        ambiguity,
        missingContext,
        expectedOutput: intent.includes('coding') ? 'implementation_guidance' : 'text_content',
        clarityScore: ambiguity === 'high' ? 0.3 : 0.8,
        tone: 'neutral', // simplified for now
        length: words < 20 ? 'short' : 'long'
    };
}
