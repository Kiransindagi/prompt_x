import { create } from 'zustand';

export type LLMPreference = 'AUTO' | 'OPENAI' | 'OPENAI_MINI' | 'CLAUDE' | 'CLAUDE_OPUS' | 'GEMINI' | 'GEMINI_FLASH' | 'OLLAMA' | string;
export type FontSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export type Theme = 'LIGHT' | 'DARK' | 'SYSTEM';

interface SettingsState {
    llmPreference: LLMPreference;
    theme: Theme;
    fontSize: FontSize;
    launchOnStartup: boolean;
    soundFeedback: boolean;
    showOnboarding: boolean;
    showShortcuts: boolean;
    saveHistory: boolean;
    showDashboard: boolean;
    // Mode Behavior
    autoEnhance: boolean;
    askBeforeRewrite: boolean;
    keepOriginalText: boolean;
    // Shortcuts
    enableGlobalShortcuts: boolean;
    rewriteShortcut: string;
    shortenShortcut: string;
    expandShortcut: string;
    // Privacy
    improveApp: boolean;
    storeLocallyOnly: boolean;
    autoDeleteHistory: boolean;
    stats: {
        tokensSaved: number;
        costSaved: number;
        optimizedRequests: number;
        modelUsageBreakdown: Record<string, number>;
    };
    showAdvancedSettings: boolean;
    ollamaUrl: string;
    ollamaModel: string;
    geminiApiKey: string;
    openaiApiKey: string;
    claudeApiKey: string;
    
    setLLMPreference: (pref: LLMPreference) => void;
    setTheme: (theme: Theme) => void;
    setFontSize: (size: FontSize) => void;
    setLaunchOnStartup: (val: boolean) => void;
    setSoundFeedback: (val: boolean) => void;
    setShowOnboarding: (val: boolean) => void;
    setShowShortcuts: (val: boolean) => void;
    setSaveHistory: (val: boolean) => void;
    setShowDashboard: (val: boolean) => void;
    setAutoEnhance: (val: boolean) => void;
    setAskBeforeRewrite: (val: boolean) => void;
    setKeepOriginalText: (val: boolean) => void;
    setEnableGlobalShortcuts: (val: boolean) => void;
    setRewriteShortcut: (val: string) => void;
    setShortenShortcut: (val: string) => void;
    setExpandShortcut: (val: string) => void;
    setImproveApp: (val: boolean) => void;
    setStoreLocallyOnly: (val: boolean) => void;
    setAutoDeleteHistory: (val: boolean) => void;
    updateStats: (updates: Partial<SettingsState['stats']>) => void;
    setShowAdvancedSettings: (val: boolean) => void;
    setOllamaUrl: (val: string) => void;
    setOllamaModel: (val: string) => void;
    setGeminiApiKey: (val: string) => void;
    setOpenaiApiKey: (val: string) => void;
    setClaudeApiKey: (val: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    llmPreference: import.meta.env.VITE_GEMINI_API_KEY ? 'GEMINI' : 'OLLAMA',
    theme: 'LIGHT',
    fontSize: 'MEDIUM',
    launchOnStartup: true,
    soundFeedback: true,
    showOnboarding: true,
    showShortcuts: true,
    saveHistory: true,
    showDashboard: false,
    autoEnhance: true,
    askBeforeRewrite: false,
    keepOriginalText: false,
    enableGlobalShortcuts: true,
    rewriteShortcut: 'Ctrl + P',
    shortenShortcut: 'Ctrl + S',
    expandShortcut: 'Ctrl + E',
    improveApp: true,
    storeLocallyOnly: false,
    autoDeleteHistory: true,
    showAdvancedSettings: false,
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'deepseek-coder:latest',
    geminiApiKey: '',
    openaiApiKey: '',
    claudeApiKey: '',
    stats: {
        tokensSaved: 14200,
        costSaved: 2.45,
        optimizedRequests: 87,
        modelUsageBreakdown: {
            'GPT-4o': 42,
            'Claude 3.5': 28,
            'Gemini 1.5': 17
        }
    },
    
    setLLMPreference: (llmPreference) => set({ llmPreference }),
    setTheme: (theme) => set({ theme }),
    setFontSize: (fontSize) => set({ fontSize }),
    setLaunchOnStartup: (launchOnStartup) => set({ launchOnStartup }),
    setSoundFeedback: (soundFeedback) => set({ soundFeedback }),
    setShowOnboarding: (showOnboarding) => set({ showOnboarding }),
    setShowShortcuts: (showShortcuts) => set({ showShortcuts }),
    setSaveHistory: (saveHistory) => set({ saveHistory }),
    setShowDashboard: (showDashboard) => set({ showDashboard }),
    setAutoEnhance: (autoEnhance) => set({ autoEnhance }),
    setAskBeforeRewrite: (askBeforeRewrite) => set({ askBeforeRewrite }),
    setKeepOriginalText: (keepOriginalText) => set({ keepOriginalText }),
    setEnableGlobalShortcuts: (enableGlobalShortcuts) => set({ enableGlobalShortcuts }),
    setRewriteShortcut: (rewriteShortcut) => set({ rewriteShortcut }),
    setShortenShortcut: (shortenShortcut) => set({ shortenShortcut }),
    setExpandShortcut: (expandShortcut) => set({ expandShortcut }),
    setImproveApp: (improveApp) => set({ improveApp }),
    setStoreLocallyOnly: (storeLocallyOnly) => set({ storeLocallyOnly }),
    setAutoDeleteHistory: (autoDeleteHistory) => set({ autoDeleteHistory }),
    updateStats: (updates) => set((state) => ({ stats: { ...state.stats, ...updates } })),
    setShowAdvancedSettings: (showAdvancedSettings) => set({ showAdvancedSettings }),
    setOllamaUrl: (ollamaUrl) => set({ ollamaUrl }),
    setOllamaModel: (ollamaModel) => set({ ollamaModel }),
    setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
    setOpenaiApiKey: (openaiApiKey) => set({ openaiApiKey }),
    setClaudeApiKey: (claudeApiKey) => set({ claudeApiKey }),
}));
