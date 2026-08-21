import { AnalysisResult } from "../../core/promptBrain/analyze";

export type OverlayState = 'hidden' | 'idle' | 'thinking' | 'expanded';

export interface OverlayPayload {
    originalText: string;
    resultText?: string;
    analysis?: AnalysisResult;
    lastActiveMode?: string;
    action?: 'rewrite' | 'shorten' | 'expand';
}
