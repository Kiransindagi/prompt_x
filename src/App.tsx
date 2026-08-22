import { useState, useEffect } from "react";
import { safeMinimize, safeMaximize } from "./utils/tauri";
// import "./App.css"; 

import { InfinityOverlay } from "./ui/overlay/InfinityOverlay";
import { useOverlayStore } from "./store/overlayStore";
import { useUserStore } from "./store/userStore";
import { useSettingsStore } from "./store/settingsStore";
import { useModeStore } from "./store/modeStore";
import { generateExpertPrompt } from "./utils/promptExpander";
import { getLLMAdapter } from "./adapters";
import { useHistoryStore } from './store/historyStore';

function App() {
  // Kept solely to type-check an unreachable legacy billing panel while it is removed in a follow-up cleanup.
  const plan: string = 'FREE';
  const setPlan = (_value: string) => undefined;
  const { user, isAuthenticated, logout, updateProfile, login } = useUserStore();
  const { 
    llmPreference, setLLMPreference, 
    theme, setTheme, 
    fontSize, setFontSize,
    launchOnStartup, setLaunchOnStartup,
    soundFeedback, setSoundFeedback,
    showOnboarding, setShowOnboarding,
    showShortcuts, setShowShortcuts,
    showDashboard, setShowDashboard,
    saveHistory, setSaveHistory,
    autoEnhance, setAutoEnhance,
    askBeforeRewrite, setAskBeforeRewrite,
    keepOriginalText, setKeepOriginalText,
    enableGlobalShortcuts, setEnableGlobalShortcuts,
    rewriteShortcut, setRewriteShortcut,
    shortenShortcut, setShortenShortcut,
    expandShortcut, setExpandShortcut,
    improveApp, setImproveApp,
    storeLocallyOnly, setStoreLocallyOnly,
    autoDeleteHistory, setAutoDeleteHistory,
    showAdvancedSettings, setShowAdvancedSettings,
    ollamaUrl, setOllamaUrl,
    ollamaModel, setOllamaModel,
    geminiApiKey, setGeminiApiKey,
    openaiApiKey, setOpenaiApiKey,
    claudeApiKey, setClaudeApiKey,
    stats, addCustomMode
  } = useSettingsStore();
  const { activeMode, setActiveMode } = useModeStore();
  
  const [shortcut, setShortcut] = useState("Ctrl + P");
  const [currentView, setCurrentView] = useState("home");
  const [settingsTab, setSettingsTab] = useState("General");
  const [modelSearch, setModelSearch] = useState("");

  // Prompt Studio States
  const [highLevelInput, setHighLevelInput] = useState("make a secure login page");
  const [promptStudioMode, setPromptStudioMode] = useState("Developer");
  const [promptStudioEngine, setPromptStudioEngine] = useState<"GEMINI" | "OPENAI" | "CLAUDE" | "OLLAMA">("GEMINI");
  const [generatedExpertPrompt, setGeneratedExpertPrompt] = useState("");
  const [isExpandingPrompt, setIsExpandingPrompt] = useState(false);
  const [expansionLatency, setExpansionLatency] = useState<number | null>(null);
  
  // Test Console States
  const [promptTestInput, setPromptTestInput] = useState("Requirements: React 19, Tailwind CSS, controlled form inputs.");
  const [promptTestOutput, setPromptTestOutput] = useState("");
  const [isTestingPrompt, setIsTestingPrompt] = useState(false);
  const [testPromptLatency, setTestPromptLatency] = useState<number | null>(null);
  const [isCreatingMode, setIsCreatingMode] = useState(false);
  const [customModeName, setCustomModeName] = useState("");
  const [customModeInstructions, setCustomModeInstructions] = useState("");
  const [customModeTone, setCustomModeTone] = useState("Professional");
  const [customModeStyle, setCustomModeStyle] = useState("Concise");
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Ollama Testing States
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [testPrompt, setTestPrompt] = useState("Write a one-line motivational quote.");
  const [testResponse, setTestResponse] = useState("");
  const [isTestingOllama, setIsTestingOllama] = useState(false);
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [ollamaStatusError, setOllamaStatusError] = useState("");

  const handleFetchOllamaModels = async () => {
    setIsFetchingModels(true);
    setOllamaStatus('idle');
    setOllamaStatusError("");
    try {
      const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
      let activeFetch = fetch;
      if (isTauri) {
        const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
        activeFetch = tauriFetch;
      }
      
      const cleanUrl = ollamaUrl.endsWith("/") ? ollamaUrl.slice(0, -1) : ollamaUrl;
      const response = await activeFetch(`${cleanUrl}/api/tags`);
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      const data = await response.json();
      if (data.models && Array.isArray(data.models)) {
        const models = data.models.map((m: any) => m.name);
        if (models.length === 0) throw new Error("Ollama is running but no local models are installed. Run: ollama pull llama3.2");
        setOllamaModels(models);
        // Use a discovered model immediately for Ctrl+P/Ctrl+S/Ctrl+E requests.
        setOllamaModel(models[0]);
        setLLMPreference('OLLAMA');
        setOllamaStatus('connected');
      } else {
        throw new Error("No models array found in Ollama response");
      }
    } catch (e: any) {
      console.error("Failed to connect to Ollama:", e);
      setOllamaStatus('error');
      setOllamaStatusError(e.message || "Ensure Ollama is running at this URL.");
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestOllama = async () => {
    if (!testPrompt.trim()) return;
    setIsTestingOllama(true);
    setTestResponse("");
    setTestLatency(null);
    const startTime = Date.now();
    try {
      const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
      let activeFetch = fetch;
      if (isTauri) {
        const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
        activeFetch = tauriFetch;
      }

      if (ollamaStatus !== 'connected') throw new Error('Connect to Ollama and choose a model before testing.');
      const cleanUrl = ollamaUrl.endsWith("/") ? ollamaUrl.slice(0, -1) : ollamaUrl;
      const response = await activeFetch(`${cleanUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: testPrompt,
          stream: false
        })
      });
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      const data = await response.json();
      setTestResponse(data.response || "No response received.");
      setTestLatency(Date.now() - startTime);
    } catch (e: any) {
      console.error("Test Ollama Failed:", e);
      setTestResponse(`[Error] Failed to generate: ${e.message}`);
    } finally {
      setIsTestingOllama(false);
    }
  };

  // Appearance Effects
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Apply Theme
    if (theme === 'DARK') {
      root.classList.add('dark');
    } else if (theme === 'LIGHT') {
      root.classList.remove('dark');
    } else if (theme === 'SYSTEM') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    // Apply Font Size
    root.style.fontSize = fontSize === 'SMALL' ? '14px' : fontSize === 'LARGE' ? '18px' : '16px';
  }, [theme, fontSize]);

  useEffect(() => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    import('@tauri-apps/api/core').then(({ invoke }) => invoke('configure_shortcuts', {
      enabled: enableGlobalShortcuts,
      rewrite: rewriteShortcut,
      shorten: shortenShortcut,
      expand: expandShortcut,
    })).catch((error) => console.error('Unable to configure shortcuts:', error));
  }, [enableGlobalShortcuts, rewriteShortcut, shortenShortcut, expandShortcut]);


  useEffect(() => {


    // Basic OS detection
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (isMac) {
      setShortcut("⌘ + P");
    } else {
      setShortcut("Ctrl + P");
    }
  }, []);

  // 7 Core Modes
  const modes = [
    { name: "Creative", desc: "Vivid storytelling & ideas", recommended: true, tags: ["Stories", "Scripts"] },
    { name: "Developer", desc: "Clean, efficient code & docs", tags: ["Debugging", "Docs"] },
    { name: "Marketing", desc: "High-conversion ads & copy", tags: ["Ads", "Social"] },
    { name: "Concise", desc: "Clear, brief, to the point", tags: ["Summaries", "TL;DR"] },
    { name: "Academic", desc: "Formal, cited, researched", tags: ["Papers", "Essays"] },
    { name: "Email", desc: "Professional communication", tags: ["Replies", "Outreach"] },
    { name: "Agentic", desc: "Autonomous task planning", tags: ["Planning", "Research"] },
  ];

  // Presets Data
  const presets = [
    { name: "Resume writing", desc: "Professional, keyword-optimized bullet points", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
    { name: "SEO article", desc: "Keyword-rich content structure", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> },
    { name: "UX copy", desc: "Microcopy for interfaces & buttons", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg> },
    { name: "Interviewer", desc: "Generate behavioral questions", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg> },
    { name: "Coding helper", desc: "Debug & explain code snippets", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg> },
    { name: "Email reply", desc: "Context-aware professional responses", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg> },
  ];

  // Recent Activity Data (Shared)
  const activityItems = useHistoryStore((state) => state.items).map((item) => ({
    ...item,
    time: new Date(item.createdAt).toLocaleString(),
    color: 'blue', label: `Generated with ${item.model}`, icon: 'zap'
  }));

  // Modal State
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  // View Details Modal Component
  const ViewDetailsModal = () => {
    if (!selectedActivity) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-black text-white text-[11px] font-bold uppercase tracking-wide rounded-full shadow-sm">{selectedActivity.mode}</span>
              <span className="text-sm text-gray-400 font-medium">{selectedActivity.time}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-100">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg>
                {selectedActivity.label}
              </span>
              <button onClick={() => setSelectedActivity(null)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>

          {/* Content Scroll Area */}
          <div className="flex-1 overflow-y-auto p-8 bg-[#F8F9FA]">
            <div className="flex flex-col gap-8">

              {/* Diff View */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Original */}
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Original</span>
                  <div className="p-5 bg-white border border-gray-200 rounded-2xl text-gray-600 font-serif leading-relaxed text-lg shadow-sm">
                    "{selectedActivity.original}"
                  </div>
                </div>

                {/* AI Version */}
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wider pl-1">AI Version</span>
                  <div className="p-6 bg-white border border-indigo-100 rounded-2xl text-gray-900 font-serif leading-relaxed text-lg shadow-lg shadow-indigo-50 relative group">
                    <div className="absolute -left-3 top-6 w-6 h-6 bg-white border border-green-200 rounded-full flex items-center justify-center text-green-600 shadow-sm z-10">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7" /></svg>
                    </div>
                    "{selectedActivity.ai}"

                    {/* Intelligent Highlights Overlay (Concept) */}
                    <div className="mt-4 pt-4 border-t border-gray-50 flex gap-2 flex-wrap">
                      {['Added intent', 'Added audience', 'Fixed tone'].map(tag => (
                        <span key={tag} className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100 font-medium">
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* System Context */}
              <div className="flex gap-4 p-4 bg-white border border-gray-100 rounded-xl items-center text-xs text-gray-500 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">System Intent:</span>
                  <span>Increase clarity • Add conversion framing • Maintain brevity</span>
                </div>
                <div className="h-4 w-px bg-gray-200 mx-auto"></div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Model:</span>
                  <span>Prompt X Auto (GPT-4o)</span>
                </div>
              </div>

              {/* Interactive Refinement */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Refine Result</span>
                <div className="bg-white border border-gray-200 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-black/5 focus-within:border-gray-300 transition-all flex gap-2 items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 ml-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </div>
                  <input
                    type="text"
                    placeholder='Ex: "Make it more professional" or "Shorter"'
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-0 placeholder:text-gray-400 text-gray-900"
                  />
                  <button className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-colors">
                    Update
                  </button>
                </div>
                <div className="flex gap-2 pl-2">
                  <span className="text-[10px] text-gray-400 font-medium py-1">Suggestions:</span>
                  {['Make it shorter', 'Add urgency', 'Change tone to friendly'].map(s => (
                    <button key={s} className="px-2 py-1 text-[10px] bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors">{s}</button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
            <button onClick={() => setSelectedActivity(null)} className="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">Close</button>
            <button className="px-5 py-2.5 text-sm font-semibold text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors shadow-sm">Copy System Prompt</button>
            <button className="px-6 py-2.5 text-sm font-semibold text-white bg-black hover:bg-gray-800 rounded-xl shadow-lg shadow-black/10 transition-all transform active:scale-95 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Accept & Copy
            </button>
          </div>

        </div>
      </div>
    );
  };

  // Edit Profile Modal
  const EditProfileModal = () => {
    const [name, setName] = useState(user?.name || "");
    const [email, setEmail] = useState(user?.email || "");

    const handleSave = () => {
      updateProfile({ name, email });
      setIsEditProfileOpen(false);
    };

    if (!isEditProfileOpen) return null;

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto" onClick={() => setIsEditProfileOpen(false)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8 flex flex-col gap-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
          <div>
            <h2 className="text-2xl font-serif text-gray-900">Edit Profile</h2>
            <p className="text-sm text-gray-500">Update your personal information.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Full Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all" 
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setIsEditProfileOpen(false)} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleSave} className="flex-1 py-3 bg-black text-white text-sm font-bold rounded-xl shadow-lg hover:bg-gray-800 transition-all active:scale-95">Save Changes</button>
          </div>
        </div>
      </div>
    );
  };

  // Auth Modal (Sign In / Sign Up)
  const AuthModal = () => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleAuth = () => {
      login({ name: name || 'User', email });
      setIsAuthModalOpen(false);
    };

    if (!isAuthModalOpen) return null;

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto" onClick={() => setIsAuthModalOpen(false)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8 flex flex-col gap-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <h2 className="text-2xl font-serif text-gray-900">{authMode === 'signin' ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="text-sm text-gray-500">{authMode === 'signin' ? 'Sign in to continue your progress' : 'Join Prompt X and start optimizing'}</p>
          </div>
          <div className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all" 
                />
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all" 
              />
            </div>
          </div>
          <button onClick={handleAuth} className="w-full py-3 bg-black text-white text-sm font-bold rounded-xl shadow-lg hover:bg-gray-800 transition-all active:scale-95">
            {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
          <div className="text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              className="text-xs text-gray-500 hover:text-black hover:underline transition-colors"
            >
              {authMode === 'signin' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Get overlay visibility state
  const isOverlayVisible = useOverlayStore((state) => state.isVisible);
  const anchorPosition = useOverlayStore((state) => state.anchorPosition);
  
  // Only show the dashboard UI if showDashboard is true from store AND overlay is NOT active
  // If running in a standard web browser (outside Tauri), force the dashboard active so it isn't a blank screen!
  const isTauri = !!(window as any).__TAURI_INTERNALS__;
  const isDashboardActive = isTauri ? (showDashboard && !isOverlayVisible) : true;

  // Handle click-through toggle and Dynamic Window Positioning
  useEffect(() => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    let cancelled = false;

    const updateWindow = async () => {
      try {
        const [{ invoke }, { getCurrentWindow, LogicalSize, PhysicalPosition }] = await Promise.all([
          import('@tauri-apps/api/core'),
          import('@tauri-apps/api/window'),
        ]);
        if (cancelled) return;
        const win = getCurrentWindow() as any;
        // Never leave an interactive dashboard or overlay click-through.
        await invoke('set_ignore_mouse', { ignore: !isOverlayVisible && !isDashboardActive });
        if (cancelled) return;
        if (isDashboardActive) {
            await win.setSize(new LogicalSize(1200, 800));
            if (cancelled) return;
            await win.center();
            if (cancelled) return;
            await win.show();
        } else if (isOverlayVisible) {
            await win.setSize(new LogicalSize(700, 800));
            if (cancelled) return;
            const dpr = window.devicePixelRatio || 1;
            const winWidth = Math.round(700 * dpr);
            const winHeight = Math.round(800 * dpr);

            let winX = Math.round(anchorPosition.x - (winWidth / 2));
            let winY = Math.round(anchorPosition.y + (30 * dpr)); 

            try {
                const monitor = await win.currentMonitor();
                if (monitor) {
                    const monitorX = monitor.position.x;
                    const monitorY = monitor.position.y;
                    const monitorWidth = monitor.size.width;
                    const monitorHeight = monitor.size.height;

                    // 1. Clamp Horizontally (Left/Right bounds)
                    if (winX < monitorX) {
                        winX = monitorX;
                    } else if (winX + winWidth > monitorX + monitorWidth) {
                        winX = monitorX + monitorWidth - winWidth;
                    }

                    // 2. Intelligent Vertical Flipping (Bottom/Top bounds)
                    // If spawning 30px below pushes it off the bottom of the screen, flip it ABOVE the cursor!
                    if (winY + winHeight > monitorY + monitorHeight) {
                        winY = Math.round(anchorPosition.y - winHeight - (10 * dpr));
                    }

                    // Clamp to the top edge to prevent it from going off-screen upwards
                    if (winY < monitorY) {
                        winY = monitorY;
                    }
                }
            } catch (err) {
                console.error("Collision detection error", err);
            }

            if (!cancelled) await win.setPosition(new PhysicalPosition(winX, winY));
        }
      } catch (error) {
        console.error('Unable to update Prompt X window state:', error);
      }
    };
    void updateWindow();
    return () => { cancelled = true; };
  }, [isOverlayVisible, isDashboardActive, anchorPosition]);

  const startWindowDrag = async (event: any) => {
    if (!isTauri || event.button !== 0 || event.target.closest('button, input, textarea, select, a')) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.error('Unable to start window drag:', error);
    }
  };

  return (
    <div className={`flex flex-col h-screen w-full relative overflow-hidden transition-all duration-300 ${isTauri ? 'bg-transparent shadow-none pointer-events-none' : 'bg-white dark:bg-black pointer-events-auto'}`}>
      {/* The Brain Overlay - Always rendered, handles its own visibility */}
      <InfinityOverlay />

      {/* Modal Portal */}
      {isDashboardActive && <ViewDetailsModal />}
      <EditProfileModal />
      <AuthModal />

      {/* DASHBOARD UI - HIDDEN BY DEFAULT */}
      {isDashboardActive && (
        <>
          {/* Top Bar (Custom Window Frame) */}
          <header onMouseDown={startWindowDrag} className="flex-shrink-0 h-[44px] bg-[#F3F3F3] dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-white/5 relative z-50 sticky top-0 cursor-grab active:cursor-grabbing">
            {/* Drag Handle Layer - Absolute spanning full width/height */}
            <div data-tauri-drag-region className="absolute inset-0 z-0" />

            {/* Content Layer - Relative on top, pointers usually pass through to drag handle unless kept auto */}
            <div className="relative z-10 flex w-full h-full justify-between items-center px-4 pointer-events-none">
              {/* Left Content */}
              <div className="flex items-center gap-4 pointer-events-auto">
                <span className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight select-none">Prompt X</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50/50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[10px] font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">Active</span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-5 pointer-events-auto">
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-50/50 rounded-full border border-gray-200/50 group relative cursor-pointer hover:bg-gray-100 transition-colors">
                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide select-none">Mode</span>
                  <span className="text-xs text-gray-700 font-semibold select-none">{activeMode}</span>
                  <div className="absolute top-full mt-2 right-0 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    Works in any app. Just highlight text and press the shortcut.
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-3 border-l border-gray-100 h-5">
                  <button onClick={() => safeMinimize()} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors focus:outline-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </button>
                  <button onClick={() => safeMaximize()} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors focus:outline-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                  </button>
                  <button onClick={() => setShowDashboard(false)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors focus:outline-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
            </div>
          </header>
        </>
      )}

      {isDashboardActive && (
        <div className="flex flex-1 overflow-hidden pointer-events-auto bg-white dark:bg-black transition-colors duration-300">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0 bg-[#F3F3F3] dark:bg-[#1a1a1a] border-r border-gray-300 dark:border-white/5 flex flex-col pt-6 pb-4 px-4 transition-colors duration-300">
            <nav className="flex-1 px-4 space-y-1">
              <button
                onClick={() => setCurrentView('home')}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-bold rounded-2xl transition-all mb-1 ${currentView === 'home' ? 'bg-black text-white shadow-lg shadow-black/5' : 'text-gray-500 hover:bg-white/60 hover:text-gray-900'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={currentView === 'home' ? "text-white" : "text-gray-400"}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                Home
              </button>
              <button
                onClick={() => setCurrentView('prompt-studio')}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-bold rounded-2xl transition-all mb-1 ${currentView === 'prompt-studio' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25' : 'text-gray-500 hover:bg-white/60 hover:text-gray-900'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={currentView === 'prompt-studio' ? "text-white" : "text-gray-400"}><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                Prompt Studio
                <span className="ml-auto px-1.5 py-0.5 text-[8px] font-black bg-amber-500 text-black rounded tracking-widest">NEW</span>
              </button>
              <button
                onClick={() => setCurrentView('activity')}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-bold rounded-2xl transition-all mb-1 ${currentView === 'activity' ? 'bg-black text-white shadow-lg shadow-black/5' : 'text-gray-500 hover:bg-white/60 hover:text-gray-900'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={currentView === 'activity' ? "text-white" : "text-gray-400"}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Activity
              </button>
              <button
                onClick={() => setCurrentView('presets')}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-bold rounded-2xl transition-all mb-1 ${currentView === 'presets' ? 'bg-black text-white shadow-lg shadow-black/5' : 'text-gray-500 hover:bg-white/60 hover:text-gray-900'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={currentView === 'presets' ? "text-white" : "text-gray-400"}><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                Presets
              </button>
              <button
                onClick={() => setCurrentView('snippets')}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-bold rounded-2xl transition-all mb-1 ${currentView === 'snippets' ? 'bg-black text-white shadow-lg shadow-black/5' : 'text-gray-500 hover:bg-white/60 hover:text-gray-900'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={currentView === 'snippets' ? "text-white" : "text-gray-400"}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Snippets
              </button>
              <button
                onClick={() => setCurrentView('modes')}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-bold rounded-2xl transition-all mb-1 ${currentView === 'modes' ? 'bg-black text-white shadow-lg shadow-black/5' : 'text-gray-500 hover:bg-white/60 hover:text-gray-900'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={currentView === 'modes' ? "text-white" : "text-gray-400"}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                Modes
              </button>

            </nav>

            <div className="px-2 mt-auto pb-2 flex flex-col gap-6">
              {/* Value Signal */}
              <div className="flex items-center gap-2 px-1 text-sm text-gray-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                <span>You saved <span className="font-semibold text-gray-600">~18 min</span> this week</span>
              </div>

              {/* Secondary Links */}
              <div className="flex flex-col gap-3 px-1">
                <button className="flex items-center gap-3 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  Invite team
                </button>
                <button className="flex items-center gap-3 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>
                  Get free month
                </button>
                <button onClick={() => { setCurrentView('settings'); setSettingsTab('General'); }} className="flex items-center gap-3 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  Settings
                </button>
                <button className="flex items-center gap-3 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  Help
                </button>
              </div>
            </div>
          </aside>
          {/* Main Content Area */}
          <main className="flex-1 overflow-auto bg-[#F3F3F3] border-l border-white/50">
            {/* VIEW: HOME */}
            {currentView === 'home' && (
              <div className="flex flex-col items-center p-8 min-h-full">
                <div className="w-full max-w-4xl flex flex-col gap-10 h-full">

                  {/* Header & Metric */}
                  <div className="flex justify-between items-end">
                    <div>
                      <h2 className="text-3xl font-serif text-gray-900 tracking-tight">Welcome back, Kiran</h2>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                      <span>Time saved: <span className="font-semibold text-gray-800">~18 min</span> this week</span>
                    </div>
                  </div>

                  {/* Hero Card */}
                  <div className="w-full bg-white rounded-3xl flex flex-col relative overflow-hidden group shadow-lg shadow-gray-200/50 transition-all hover:shadow-xl">
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-gray-900 z-10 transition-all group-hover:bg-blue-600"></div>
                    <div className="p-8 pb-6 flex flex-col gap-5 relative z-10">
                      <h3 className="text-2xl font-serif text-gray-900 leading-tight">
                        Select text anywhere and press{" "}
                        <span className="inline-flex items-center gap-1 mx-1.5 align-baseline animate-pulse">
                          <kbd className="font-sans text-xs font-bold text-gray-700 bg-white border-b-2 border-gray-300 border border-gray-200 px-2 py-1 rounded-md shadow-sm min-w-[2.5rem] text-center">{shortcut.split(" + ")[0]}</kbd>
                          <span className="text-gray-400 font-sans">+</span>
                          <kbd className="font-sans text-xs font-bold text-gray-700 bg-white border-b-2 border-gray-300 border border-gray-200 px-2 py-1 rounded-md shadow-sm min-w-[2rem] text-center">{shortcut.split(" + ")[1]}</kbd>
                        </span>
                      </h3>
                      <p className="text-gray-500 text-sm font-medium">Prompt X will instantly rewrite it in <span className="text-gray-800 font-semibold underline decoration-gray-300 underline-offset-4">{activeMode} mode</span>.</p>
                    </div>
                    <div className="px-8 py-3 bg-white border-t border-gray-100 flex items-center gap-6 text-xs text-gray-500">
                      <div className="flex items-center gap-2"><span className="uppercase tracking-wider font-bold text-gray-400 text-[10px]">Status</span><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span><span className="font-medium text-gray-700">System Ready</span></div>
                      <div className="w-px h-3 bg-gray-200"></div>
                      <div className="flex items-center gap-2"><span className="uppercase tracking-wider font-bold text-gray-400 text-[10px]">Auto-enhance</span><span className="font-semibold text-gray-800">ON</span></div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 w-full overflow-x-auto pb-2 scrollbar-hide">
                    {['Rewrite', 'Shorten', 'Expand', 'Change Tone', 'System Prompt'].map(action => (
                      <button key={action} className="px-5 py-3 bg-white text-gray-600 text-sm font-bold rounded-2xl hover:shadow-lg hover:text-gray-900 transition-all whitespace-nowrap shadow-sm shadow-gray-200/50">{action}</button>
                    ))}
                  </div>

                  {/* Recent Activity */}
                  <div className="flex flex-col gap-4 pb-12">
                    <div className="flex justify-between items-center px-1">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent Activity</h4>
                      <button onClick={() => setCurrentView('activity')} className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                      {activityItems.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-[2rem] p-0 shadow-lg shadow-gray-200/50 overflow-hidden group hover:shadow-xl transition-all">
                          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-50">
                            <div className="flex items-center gap-3"><span className={`px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-wide rounded-full`}>{item.mode}</span><span className="text-xs text-gray-400 font-medium">{item.time}</span></div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-gray-900 px-3 py-1 rounded-full bg-gray-100 flex items-center gap-1">
                                {item.icon === 'arrow' ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-900"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-900"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>}
                                {item.label}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 divide-x divide-gray-50">
                            <div className="p-6"><div className="text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-2">Original</div><p className="text-sm text-gray-500 font-medium leading-relaxed">"{item.original}"</p></div>
                            <div className="p-6 bg-[#F8F9FA]"><div className="text-[10px] uppercase text-gray-900 font-bold tracking-wider mb-2">AI Version</div><p className="text-sm text-gray-900 font-bold leading-relaxed">"{item.ai}"</p></div>
                          </div>
                          <div className="flex justify-end gap-2 p-4 border-t border-gray-50"><button onClick={() => setSelectedActivity(item)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white hover:bg-black rounded-lg transition-all">View Details</button></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: ACTIVITY (Formerly History) */}
            {currentView === 'activity' && (
              <div className="flex flex-col p-10 h-full overflow-auto items-center">
                <div className="max-w-3xl w-full">
                  <h2 className="text-2xl font-serif text-gray-900 mb-2">Activity</h2>
                  <p className="text-gray-500 mb-8">Your recent improvements and prompt history.</p>

                  <div className="space-y-4">
                    {activityItems.map((item, idx) => (
                      <div key={idx} className="bg-white rounded-[2rem] p-0 shadow-lg shadow-gray-200/50 overflow-hidden group hover:shadow-xl transition-all">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-50">
                          <div className="flex items-center gap-3"><span className={`px-3 py-1 bg-black text-white text-[11px] font-bold uppercase tracking-wide rounded-full`}>{item.mode}</span><span className="text-xs text-gray-400 font-medium">{item.time}</span></div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-900 px-3 py-1 rounded-full bg-gray-100 flex items-center gap-1">
                              {item.icon === 'arrow' ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-900"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-900"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>}
                              {item.label}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-gray-50">
                          <div className="p-6"><div className="text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-2">Original</div><p className="text-sm text-gray-500 font-medium leading-relaxed">"{item.original}"</p></div>
                          <div className="p-6 bg-[#F8F9FA]"><div className="text-[10px] uppercase text-gray-900 font-bold tracking-wider mb-2">AI Version</div><p className="text-sm text-gray-900 font-bold leading-relaxed">"{item.ai}"</p></div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-gray-50"><button onClick={() => setSelectedActivity(item)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white hover:bg-black rounded-lg transition-all">View Details</button></div>
                      </div>
                    ))}
                    {/* Placeholder for older history */}
                    <div className="text-center py-6">
                      <span className="text-xs text-gray-400">Viewing last 24 hours</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: PRESETS (NEW) */}
            {currentView === 'presets' && (
              <div className="flex flex-col p-10 h-full overflow-auto items-center">
                <div className="max-w-4xl w-full">
                  <div className="mb-8">
                    <h2 className="text-2xl font-serif text-gray-900 mb-2">Task Presets</h2>
                    <p className="text-gray-500">Select any text and click a preset to apply instantly.</p>
                  </div>

                  {/* Recommended Strip */}
                  <div className="mb-8">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Recommended for you</h3>
                    <div className="flex gap-3">
                      {["Resume writing", "Email reply", "SEO article"].map(item => (
                        <div key={item} className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 shadow-sm flex items-center gap-2 cursor-pointer hover:border-blue-300 hover:text-blue-600 transition-colors">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                    {presets.map(preset => (
                      <button key={preset.name} className="flex flex-col text-left p-5 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-gray-300 transition-all group">
                        <div className="text-2xl mb-3 text-gray-700">{preset.icon}</div>
                        <div className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">{preset.name}</div>
                        <div className="text-sm text-gray-500 leading-relaxed">{preset.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Recent Presets */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Recent Presets</h3>
                    <div className="p-8 border border-dashed border-gray-200 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      <p className="text-sm text-gray-400">No presets used yet. Try one above to get started.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: SNIPPETS (Placeholder) */}
            {currentView === 'snippets' && (
              <div className="flex flex-col p-10 h-full overflow-auto items-center">
                <div className="max-w-2xl w-full flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <h2 className="text-2xl font-serif text-gray-900 mb-2">Snippets</h2>
                  <p className="text-gray-500 mb-8 max-w-md mx-auto">Snippets let you reuse powerful prompts across apps. Save your best instructions once and use them everywhere.</p>

                  <button className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm mb-16">
                    Create First Snippet
                  </button>

                  {/* Example Snippets */}
                  <div className="w-full text-left">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Example Snippets</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg opacity-60 pointer-events-none select-none">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Tone Modifier</div>
                        <div className="text-sm text-gray-400 font-serif">"Rewrite this in a professional, confident tone."</div>
                      </div>
                      <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg opacity-60 pointer-events-none select-none">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Summarizer</div>
                        <div className="text-sm text-gray-400 font-serif">"Summarize this text in 3 concise bullet points."</div>
                      </div>
                      <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg opacity-60 pointer-events-none select-none">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Persona</div>
                        <div className="text-sm text-gray-400 font-serif">"Act as a senior User Experience writer."</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 p-4 bg-blue-50 text-blue-800 text-sm rounded-lg flex items-center gap-2 justify-center w-full max-w-lg">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    <span><strong>Tip:</strong> You can save prompts from Activity as snippets so you don't lose them.</span>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: PROMPT STUDIO */}
            {currentView === 'prompt-studio' && (
              <div className="flex flex-col p-8 h-full overflow-auto bg-gray-50 dark:bg-[#0f0f12] transition-colors duration-300">
                <div className="max-w-6xl mx-auto w-full">
                  
                  {/* Header */}
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 text-[10px] font-black tracking-widest text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-full uppercase shadow-sm">
                        Power Suite
                      </span>
                    </div>
                    <h2 className="text-3xl font-bold font-serif text-gray-900 dark:text-white mb-2 tracking-tight transition-colors duration-300">
                      AI Prompt Engineering Studio
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-2xl text-sm transition-colors duration-300">
                      Transform a simple, high-level user request (e.g. "make a login page") into an extremely detailed, professional, prompt-engineer level system prompt, tailored perfectly to your selected mode.
                    </p>
                  </div>

                  {/* Main Two-Column Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Column: Creator / Expander */}
                    <div className="lg:col-span-5 space-y-6">
                      
                      {/* Section 1: Raw Prompt Input */}
                      <div className="p-6 bg-white dark:bg-[#1a1a24] rounded-3xl border border-gray-200 dark:border-white/5 shadow-xl shadow-black/[0.02] transition-all">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          1. Simple User Input
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                          Enter your high-level description of what you want the AI to do.
                        </p>
                        <textarea
                          value={highLevelInput}
                          onChange={(e) => setHighLevelInput(e.target.value)}
                          placeholder="e.g. create a beautiful landing page with glassmorphic cards"
                          rows={4}
                          className="w-full px-4 py-3 text-sm font-medium border border-gray-200 dark:border-white/10 rounded-2xl bg-gray-50 dark:bg-[#121218] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-serif resize-none"
                        />
                      </div>

                      {/* Section 2: Mode Selector */}
                      <div className="p-6 bg-white dark:bg-[#1a1a24] rounded-3xl border border-gray-200 dark:border-white/5 shadow-xl shadow-black/[0.02] transition-all">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          2. Target Mode
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                          Select the target persona guidelines to bake into your expert prompt.
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: "creative", label: "Creative", color: "from-purple-500 to-pink-500", desc: "Expressive & vivid" },
                            { id: "developer", label: "Developer", color: "from-blue-500 to-cyan-500", desc: "Tech & structured" },
                            { id: "marketing", label: "Marketing", color: "from-amber-500 to-orange-500", desc: "Copy & conversion" }
                          ].map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setPromptStudioMode(m.id)}
                              className={`relative p-3.5 rounded-2xl border text-left transition-all ${promptStudioMode === m.id ? 'border-transparent shadow-lg shadow-black/5 dark:shadow-black/20 text-white' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 text-gray-700 dark:text-gray-300'}`}
                            >
                              {promptStudioMode === m.id && (
                                <div className={`absolute inset-0 bg-gradient-to-br ${m.color} rounded-2xl -z-10`} />
                              )}
                              <div className="text-sm font-black tracking-tight">{m.label}</div>
                              <div className={`text-[10px] mt-1 ${promptStudioMode === m.id ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>{m.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section 3: Engine & API Key Setup */}
                      <div className="p-6 bg-white dark:bg-[#1a1a24] rounded-3xl border border-gray-200 dark:border-white/5 shadow-xl shadow-black/[0.02] transition-all">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          3. LLM Engine & API Keys
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                          Choose the engine to execute prompt engineering. Paste your key directly in the UI for instant testing.
                        </p>

                        <div className="grid grid-cols-4 gap-2 mb-4">
                          {[
                            { id: "GEMINI", label: "Gemini" },
                            { id: "OPENAI", label: "OpenAI" },
                            { id: "CLAUDE", label: "Claude" },
                            { id: "OLLAMA", label: "Ollama" }
                          ].map((engine) => (
                            <button
                              key={engine.id}
                              onClick={() => setPromptStudioEngine(engine.id as any)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${promptStudioEngine === engine.id ? 'bg-gray-900 border-gray-900 text-white dark:bg-white dark:border-white dark:text-black shadow-sm' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                              {engine.label}
                            </button>
                          ))}
                        </div>

                        {/* Direct API Key Inputs based on selected engine */}
                        {promptStudioEngine === "GEMINI" && (
                          <div className="space-y-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Gemini API Key</label>
                            <input
                              type="password"
                              value={geminiApiKey}
                              onChange={(e) => setGeminiApiKey(e.target.value)}
                              placeholder={import.meta.env.VITE_GEMINI_API_KEY ? "Using .env key..." : "Paste Gemini API key here..."}
                              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-[#121218] text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">Kept only for this app session and sent only to the selected provider.</p>
                          </div>
                        )}

                        {promptStudioEngine === "OPENAI" && (
                          <div className="space-y-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">OpenAI API Key</label>
                            <input
                              type="password"
                              value={openaiApiKey}
                              onChange={(e) => setOpenaiApiKey(e.target.value)}
                              placeholder={import.meta.env.VITE_OPENAI_API_KEY ? "Using .env key..." : "Paste OpenAI API key here..."}
                              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-[#121218] text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">Kept only for this app session.</span>
                            </div>
                          </div>
                        )}

                        {promptStudioEngine === "CLAUDE" && (
                          <div className="space-y-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Claude API Key</label>
                            <input
                              type="password"
                              value={claudeApiKey}
                              onChange={(e) => setClaudeApiKey(e.target.value)}
                              placeholder={import.meta.env.VITE_CLAUDE_API_KEY ? "Using .env key..." : "Paste Claude API key here..."}
                              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-[#121218] text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">Kept only for this app session.</span>
                            </div>
                          </div>
                        )}

                        {promptStudioEngine === "OLLAMA" && (
                          <div className="space-y-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200 bg-gray-50 dark:bg-[#121218] p-3 rounded-xl border border-gray-200 dark:border-white/5">
                            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">Local Ollama Details:</span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 block">Host URL: <strong className="font-mono text-gray-600 dark:text-gray-300">{ollamaUrl}</strong></span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 block">Active Model: <strong className="font-mono text-gray-600 dark:text-gray-300">{ollamaModel}</strong></span>
                          </div>
                        )}

                        {/* Generate Button */}
                        <button
                          onClick={async () => {
                            if (!highLevelInput.trim()) return;
                            setIsExpandingPrompt(true);
                            setGeneratedExpertPrompt("");
                            try {
                              const result = await generateExpertPrompt(
                                highLevelInput,
                                promptStudioMode,
                                promptStudioEngine.toLowerCase() as any
                              );
                              setGeneratedExpertPrompt(result.prompt);
                              setExpansionLatency(result.latency);
                            } catch (e: any) {
                              setGeneratedExpertPrompt(`[Error] Prompt generation failed: ${e.message}\n\nPlease check your API keys or connection settings!`);
                            } finally {
                              setIsExpandingPrompt(false);
                            }
                          }}
                          disabled={isExpandingPrompt || !highLevelInput.trim()}
                          className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm rounded-2xl hover:shadow-xl hover:shadow-blue-500/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {isExpandingPrompt ? (
                            <>
                              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Designing System Prompt...
                            </>
                          ) : (
                            <>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                              Generate Expert Prompt
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Expanded Output & Testing Sandbox */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {!generatedExpertPrompt && !isExpandingPrompt && (
                        <div className="p-12 bg-white dark:bg-[#1a1a24] rounded-3xl border border-gray-200 dark:border-white/5 text-center flex flex-col items-center justify-center gap-4 min-h-[400px]">
                          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center text-blue-500">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                          </div>
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white font-serif">Awaiting Prompt Construction</h4>
                          <p className="text-gray-400 dark:text-gray-500 max-w-sm text-sm">
                            Configure your high-level input on the left and click "Generate" to watch advanced prompt-engineering guidelines be generated in real time.
                          </p>
                        </div>
                      )}

                      {isExpandingPrompt && (
                        <div className="p-12 bg-white dark:bg-[#1a1a24] rounded-3xl border border-gray-200 dark:border-white/5 text-center flex flex-col items-center justify-center gap-6 min-h-[400px]">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon></svg>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white font-serif mb-1.5">Drafting Advanced Syllabus</h4>
                            <p className="text-gray-400 dark:text-gray-500 max-w-sm text-sm">
                              Applying elite prompt expansion methodologies...
                            </p>
                          </div>
                        </div>
                      )}

                      {generatedExpertPrompt && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          
                          {/* Output Card */}
                          <div className="p-6 bg-white dark:bg-[#1a1a24] rounded-3xl border border-gray-200 dark:border-white/5 shadow-xl shadow-black/[0.02]">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                Engineered Prompt
                              </h3>
                              <div className="flex items-center gap-2">
                                {expansionLatency && (
                                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-400 rounded-full font-mono">
                                    Latency: {expansionLatency}ms
                                  </span>
                                )}
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(generatedExpertPrompt);
                                  }}
                                  className="px-3 py-1 text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl transition-all"
                                >
                                  Copy Prompt
                                </button>
                              </div>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-[#121218] border border-gray-200 dark:border-white/10 rounded-2xl max-h-[300px] overflow-auto">
                              <pre className="text-xs font-mono text-gray-800 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">{generatedExpertPrompt}</pre>
                            </div>
                          </div>

                          {/* Sandbox / Test Run Console */}
                          <div className="p-6 bg-white dark:bg-[#1a1a24] rounded-3xl border border-gray-200 dark:border-white/5 shadow-xl shadow-black/[0.02]">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                              4. Interactive Test Console
                            </h3>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                              Test your new prompt right here! Supply some sample input (context/data) and see the generated response.
                            </p>

                            <div className="space-y-4">
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Test Context / Input</label>
                                <textarea
                                  value={promptTestInput}
                                  onChange={(e) => setPromptTestInput(e.target.value)}
                                  placeholder="Type input text to test the prompt against..."
                                  rows={2}
                                  className="w-full px-4 py-2 text-xs font-medium border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-[#121218] text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <button
                                onClick={async () => {
                                  setIsTestingPrompt(true);
                                  setPromptTestOutput("");
                                  const startSimTime = Date.now();
                                  try {
                                    const adapter = getLLMAdapter(promptStudioEngine.toLowerCase() as any);
                                    const fullOutput = await adapter.generate({
                                      systemPrompt: generatedExpertPrompt,
                                      userPrompt: promptTestInput,
                                      temperature: 0.7
                                    });
                                    setPromptTestOutput(fullOutput);
                                    setTestPromptLatency(Date.now() - startSimTime);
                                  } catch (err: any) {
                                    setPromptTestOutput(`[Error] Simulation failed: ${err.message}`);
                                  } finally {
                                    setIsTestingPrompt(false);
                                  }
                                }}
                                disabled={isTestingPrompt}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-950 text-white dark:bg-white dark:text-black font-bold text-xs rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50"
                              >
                                {isTestingPrompt ? (
                                  <>
                                    <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Running Simulation...
                                  </>
                                ) : (
                                  <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                    Run Simulation Test
                                  </>
                                )}
                              </button>

                              {/* Simulation Result Area */}
                              {(promptTestOutput || isTestingPrompt) && (
                                <div className="mt-4 p-4 bg-gray-50 dark:bg-[#121218] border border-gray-200 dark:border-white/10 rounded-2xl animate-in fade-in slide-in-from-top-1 duration-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Simulated Output Preview</span>
                                    {testPromptLatency && !isTestingPrompt && (
                                      <span className="text-[9px] font-mono text-gray-400">Response in {testPromptLatency}ms</span>
                                    )}
                                  </div>
                                  {isTestingPrompt ? (
                                    <div className="space-y-2 py-4">
                                      <div className="h-3 bg-gray-200 dark:bg-white/5 rounded animate-pulse w-3/4"></div>
                                      <div className="h-3 bg-gray-200 dark:bg-white/5 rounded animate-pulse w-5/6"></div>
                                      <div className="h-3 bg-gray-200 dark:bg-white/5 rounded animate-pulse w-2/3"></div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-700 dark:text-gray-300 font-sans whitespace-pre-wrap leading-relaxed">
                                      {promptTestOutput}
                                    </div>
                                  )}
                                </div>
                              )}

                            </div>
                          </div>

                        </div>
                      )}

                    </div>

                  </div>

                </div>
              </div>
            )}

            {/* VIEW: MODES (USAGE) */}
            {currentView === 'modes' && (
              <div className="flex flex-col p-10 h-full overflow-auto items-center">
                <div className="max-w-3xl w-full">
                  <h2 className="text-2xl font-serif text-gray-900 dark:text-white transition-colors duration-300">Select a Mode</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-8 transition-colors duration-300">Choose the prompt behavior you want to use.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {modes.map(mode => (
                      <div
                        key={mode.name}
                        onClick={() => setActiveMode(mode.name)}
                        className={`p-5 bg-white dark:bg-white/5 border rounded-2xl hover:shadow-lg cursor-pointer transition-all flex flex-col gap-2 relative overflow-hidden group ${activeMode === mode.name ? 'border-gray-900 dark:border-white ring-1 ring-gray-900 dark:ring-white bg-gray-50 dark:bg-white/10' : 'border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20'}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`font-semibold transition-colors ${activeMode === mode.name ? 'text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white'}`}>{mode.name}</span>
                          {activeMode === mode.name && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">{mode.desc}</p>

                        {/* Common Tasks Tags */}
                        {mode.tags && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {mode.tags.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-[10px] rounded border border-gray-200 dark:border-white/5">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Custom Modes */}
                  <div className="mb-8 p-0.5 rounded-[2rem] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-xl shadow-indigo-500/10 transition-all transform hover:scale-[1.01]">
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-[1.95rem] p-8 flex flex-col md:flex-row gap-8 items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Custom Modes</h3>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
                          Design your own prompt behavior with system instructions, tone rules, and output style.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {[
                            { label: 'Brand voice', icon: 'mic' },
                            { label: 'Personal workflow', icon: 'user' },
                            { label: 'Team standards', icon: 'users' }
                          ].map(f => (
                            <div key={f.label} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl transition-colors duration-300">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{f.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <button 
                          onClick={() => setIsCreatingMode(true)}
                          className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black text-sm font-black rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          Create Custom Mode
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Active Mode Explanation Panel */}
                   <div className="p-6 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl w-full transition-colors duration-300 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Active Mode: <span className="text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">{activeMode}</span></h3>
                    </div>
                    <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300 mb-6 pl-1 transition-colors duration-300">
                      {activeMode === 'Creative' && <>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-indigo-500 rounded-full mt-2 shrink-0"></div>
                          <span>Expands on your initial ideas with rich vocabulary.</span>
                        </li>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-indigo-500 rounded-full mt-2 shrink-0"></div>
                          <span>Prioritizes engaging storytelling over brevity.</span>
                        </li>
                        <li className="flex gap-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mt-2">Best for: Blogs, fiction, brainstorming.</li>
                      </>}
                      {activeMode === 'Developer' && <>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-green-500 rounded-full mt-2 shrink-0"></div>
                          <span>Analyzes code logic and structure.</span>
                        </li>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-green-500 rounded-full mt-2 shrink-0"></div>
                          <span>Provides explanations and debugging tips.</span>
                        </li>
                        <li className="flex gap-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mt-2">Best for: Python, JS, refactoring.</li>
                      </>}
                      {activeMode === 'Marketing' && <>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-red-500 rounded-full mt-2 shrink-0"></div>
                          <span>Focuses on persuasion and conversion.</span>
                        </li>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-red-500 rounded-full mt-2 shrink-0"></div>
                          <span>Uses power words and strong calls to action.</span>
                        </li>
                        <li className="flex gap-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mt-2">Best for: Ads, landing pages, emails.</li>
                      </>}
                      {activeMode === 'Concise' && <>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-amber-500 rounded-full mt-2 shrink-0"></div>
                          <span>Strips away fluff and filler words.</span>
                        </li>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-amber-500 rounded-full mt-2 shrink-0"></div>
                          <span>Delivers information in the shortest possible form.</span>
                        </li>
                        <li className="flex gap-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mt-2">Best for: Summaries, fast reading.</li>
                      </>}
                      {activeMode === 'Academic' && <>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-blue-500 rounded-full mt-2 shrink-0"></div>
                          <span>Uses formal language and citation structures.</span>
                        </li>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-blue-500 rounded-full mt-2 shrink-0"></div>
                          <span>Maintains objectivity and rigor.</span>
                        </li>
                        <li className="flex gap-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mt-2">Best for: Papers, essays, research.</li>
                      </>}
                      {activeMode === 'Email' && <>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-indigo-400 rounded-full mt-2 shrink-0"></div>
                          <span>Adjusts tone for professional correspondence.</span>
                        </li>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-indigo-400 rounded-full mt-2 shrink-0"></div>
                          <span>Ensures clarity and poleness.</span>
                        </li>
                        <li className="flex gap-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mt-2">Best for: Client replies, internal updates.</li>
                      </>}
                      {activeMode === 'Agentic' && <>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-purple-500 rounded-full mt-2 shrink-0"></div>
                          <span>Breaks down complex requests into steps.</span>
                        </li>
                        <li className="flex gap-2">
                          <div className="w-1 h-1 bg-purple-500 rounded-full mt-2 shrink-0"></div>
                          <span>Plans execution strategy autonomously.</span>
                        </li>
                        <li className="flex gap-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mt-2">Best for: Multi-step problems, research plans.</li>
                      </>}
                    </ul>
                    <div className="pt-4 border-t border-gray-200/60 dark:border-white/5 text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5 uppercase tracking-wide font-bold transition-colors duration-300">
                      System Mode — Global Default
                    </div>

                  <div className="mt-8 text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-600 cursor-pointer hover:text-gray-600 dark:hover:text-gray-400 transition-colors" onClick={() => { setCurrentView('settings'); setSettingsTab('Modes'); }}>Manage modes and defaults in Settings</p>
                  </div>

                  </div>
                </div>
              </div>
            )}

            {/* VIEW: SETTINGS */}
            {currentView === 'settings' && (
              <div className="flex h-full">
                {/* Settings Sub-sidebar */}
                <div className="w-56 border-r border-gray-200 dark:border-white/5 bg-white dark:bg-[#1a1a1a] pt-8 px-4 flex flex-col gap-1 rounded-tr-3xl transition-colors duration-300">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 px-2">Settings</h3>
                  {['General', 'AI & Models', 'Modes', 'Shortcuts', 'Privacy', 'About'].map(item => (
                    <button key={item} onClick={() => setSettingsTab(item)} className={`text-left px-4 py-2.5 rounded-2xl text-sm font-bold transition-colors ${settingsTab === item ? 'bg-black dark:bg-white text-white dark:text-black shadow-md' : 'text-gray-500 hover:bg-white hover:text-gray-900 dark:hover:text-white'}`}>{item}</button>
                  ))}
                </div>
                <div className="flex-1 p-10 overflow-auto bg-white dark:bg-black transition-colors duration-300">
                  <div className="max-w-2xl flex flex-col gap-8">
                    {settingsTab === 'General' && (
                      <>
                        <div><h2 className="text-2xl font-serif text-gray-900 dark:text-white transition-colors duration-300">General</h2><p className="text-gray-500 dark:text-gray-400 mt-1">Manage your identity and application preferences.</p></div>

                        {/* Profile Card with Stats */}
                        <div className="flex flex-col gap-4 p-4 border border-gray-200 dark:border-white/5 rounded-xl bg-white dark:bg-white/5 shadow-sm transition-colors duration-300">
                          {isAuthenticated ? (
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-inner uppercase">
                                {user?.name.charAt(0) || 'U'}
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">{user?.name}</h3>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</div>
                                <div className="mt-1 flex items-center gap-2">
                                  <button onClick={logout} className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-wide ml-2">Logout</button>
                                </div>
                              </div>
                              <button 
                                onClick={() => setIsEditProfileOpen(true)}
                                className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Edit Profile
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center py-4 gap-3">
                              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                              </div>
                              <div className="text-center">
                                <h3 className="font-semibold text-gray-900">Sign in to Prompt X</h3>
                                <p className="text-xs text-gray-500">Sync history and preferences across devices.</p>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => { setAuthMode('signin'); setIsAuthModalOpen(true); }}
                                  className="px-4 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                  Sign In
                                </button>
                                <button 
                                  onClick={() => { setAuthMode('signup'); setIsAuthModalOpen(true); }}
                                  className="px-4 py-1.5 bg-white border border-gray-200 text-black text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  Sign Up
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="flex gap-6 border-t border-gray-50 pt-3 px-1">
                            {[
                              { label: "Prompts enhanced", value: stats.optimizedRequests },
                              { label: "Time saved", value: stats.costSaved > 1 ? `~$${stats.costSaved.toFixed(0)} saved` : `~18 min` },
                              { label: "Active modes", value: "3" }
                            ].map(stat => (
                              <div key={stat.label} className="flex flex-col">
                                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{stat.label}</span>
                                <span className="text-xs font-semibold text-gray-700">{stat.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Appearance */}
                        <div className="border-t border-gray-100 dark:border-white/5 pt-6 transition-colors duration-300">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Appearance</h3>

                          <div className="flex items-center gap-4 mb-4">
                            <span className="text-sm text-gray-500 dark:text-gray-400 w-16">Font Size</span>
                            <div className="flex gap-2">
                              {['SMALL', 'MEDIUM', 'LARGE'].map(size => (
                                <button 
                                  key={size}
                                  onClick={() => setFontSize(size as any)}
                                  className={`px-3 py-1 text-xs font-medium border rounded transition-all ${fontSize === size ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                >
                                  {size.charAt(0) + size.slice(1).toLowerCase()}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mb-3">
                            <span className="text-sm text-gray-500 w-16">Theme</span>
                            <div className="flex gap-4">
                              {['LIGHT', 'DARK', 'SYSTEM'].map(t => (
                                <label key={t} className="flex items-center gap-2 cursor-pointer group">
                                  <input 
                                    type="radio" 
                                    name="theme" 
                                    checked={theme === t} 
                                    onChange={() => setTheme(t as any)}
                                    className="text-black focus:ring-black" 
                                  />
                                  <span className={`text-sm transition-colors ${theme === t ? 'text-black dark:text-white font-semibold' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white'}`}>
                                    {t.charAt(0) + t.slice(1).toLowerCase()}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="mt-2 p-3 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-lg text-xs text-gray-500 dark:text-gray-400 text-center font-serif italic transition-colors duration-300">
                            "This is how Prompt X will look"
                          </div>
                        </div>

                        {/* Behavior */}
                        <div className="border-t border-gray-100 dark:border-white/5 pt-6 transition-colors duration-300">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Behavior</h3>

                          <div className="mb-4">
                            <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Startup & Feedback</h4>
                            <div className="space-y-2">
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={launchOnStartup} 
                                    onChange={(e) => setLaunchOnStartup(e.target.checked)}
                                    className="rounded border-gray-300 dark:border-white/10 dark:bg-white/5 text-black focus:ring-black" 
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors">Launch Prompt X on startup</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  checked={soundFeedback} 
                                  onChange={(e) => setSoundFeedback(e.target.checked)}
                                  className="rounded border-gray-300 dark:border-white/10 dark:bg-white/5 text-black focus:ring-black" 
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors">Enable sound feedback</span>
                              </label>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Guidance</h4>
                            <div className="space-y-2">
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  checked={showOnboarding} 
                                  onChange={(e) => setShowOnboarding(e.target.checked)}
                                  className="rounded border-gray-300 dark:border-white/10 dark:bg-white/5 text-black focus:ring-black" 
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors">Show onboarding tips</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  checked={showShortcuts} 
                                  onChange={(e) => setShowShortcuts(e.target.checked)}
                                  className="rounded border-gray-300 dark:border-white/10 dark:bg-white/5 text-black focus:ring-black" 
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors">Show keyboard shortcut hints</span>
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* System Status */}
                        <div className="border-t border-gray-100 dark:border-white/5 pt-6 transition-colors duration-300">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">System Status</h3>
                          <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-5 space-y-3 transition-colors duration-300">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-500 dark:text-gray-400">Environment</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${(window as any).__TAURI_INTERNALS__ ? 'bg-blue-500' : 'bg-amber-500'} animate-pulse`}></span>
                                <span className="text-gray-900 dark:text-white font-medium">{(window as any).__TAURI_INTERNALS__ ? 'Desktop App' : 'Browser Mode'}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-500 dark:text-gray-400">Background Engine</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${(window as any).__TAURI_INTERNALS__ ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-400'}`}></span>
                                <span className="text-gray-900 dark:text-white font-medium">{(window as any).__TAURI_INTERNALS__ ? 'Running' : 'Not Available'}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-500 dark:text-gray-400">Global Shortcut</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${(window as any).__TAURI_INTERNALS__ ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`}></span>
                                <span className="text-gray-900 dark:text-white font-medium">{(window as any).__TAURI_INTERNALS__ ? 'Registered' : 'Desktop Only'}</span>
                              </div>
                            </div>
                            <div className="pt-2 flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-600 border-t border-gray-200/50 dark:border-white/5 mt-2">
                              <span>Latency: ~42ms</span>
                              <span>Ver: 0.1.0-beta</span>
                            </div>
                          </div>
                        </div>

                        {/* Looking for more control? */}
                        <div className="mt-6 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-3xl transition-all">
                          <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-4">Looking for more control?</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                              { label: 'Customize modes', tab: 'Modes', icon: 'zap' },
                              { label: 'Change AI model', tab: 'AI & Models', icon: 'cpu' },
                              { label: 'Manage shortcuts', tab: 'Shortcuts', icon: 'command' },
                            ].map(item => (
                              <button 
                                key={item.label}
                                onClick={() => setSettingsTab(item.tab)}
                                className="flex items-center justify-between p-3 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all group text-left"
                              >
                                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400 group-hover:text-indigo-900 dark:group-hover:text-white">{item.label}</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-300 group-hover:text-indigo-500 transition-colors"><polyline points="9 18 15 12 9 6"></polyline></svg>
                              </button>
                            ))}
                          </div>
                        </div>

                      </>
                    )}
                    {settingsTab === 'AI & Models' && (
                      <>
                        <div><h2 className="text-2xl font-serif text-gray-900 dark:text-white transition-colors duration-300">AI & Models</h2><p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors duration-300">Configure how Prompt X generates and rewrites your content.</p></div>

                        {/* System Summary Card */}
                        <div className="bg-gray-900 dark:bg-[#1a1a1a] rounded-2xl p-6 text-gray-300 text-sm shadow-xl border border-white/5 transition-colors duration-300">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Current AI Configuration</div>
                          <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                            <div className="flex flex-col"><span className="text-xs text-gray-500 mb-0.5">Model strategy</span><span className="text-gray-100 font-medium">{llmPreference === 'AUTO' ? 'Prompt X Auto' : 'Manual Selection'}</span></div>
                            <div className="flex flex-col"><span className="text-xs text-gray-500 mb-0.5">Primary model</span><span className="text-gray-100 font-medium">{llmPreference === 'AUTO' ? 'GPT-4o' : llmPreference}</span></div>
                            <div className="flex flex-col"><span className="text-xs text-gray-500 mb-0.5">Fallback models</span><span className="text-gray-100 font-medium">Claude, Gemini</span></div>
                            <div className="flex flex-col"><span className="text-xs text-gray-500 mb-0.5">Optimization</span><span className="text-gray-100 font-medium">Balanced</span></div>
                          </div>
                        </div>

                        <div 
                          onClick={() => setLLMPreference('AUTO')}
                          className={`border rounded-2xl overflow-hidden bg-white dark:bg-white/5 shadow-sm cursor-pointer transition-all ${llmPreference === 'AUTO' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'}`}
                        >
                          <div className="p-4 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center transition-colors duration-300">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">Recommended Model</span>
                            {llmPreference === 'AUTO' && <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>}
                          </div>
                          <div className="p-6 flex items-start gap-4">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${llmPreference === 'AUTO' ? 'bg-blue-600' : 'border-2 border-gray-200 dark:border-gray-700'}`}>
                                {llmPreference === 'AUTO' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white transition-colors duration-300">Prompt X Auto (Recommended)</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed transition-colors duration-300">Best balance of quality, speed, and cost. Automatically switches models per task.</div>
                              <div className="mt-2 text-xs text-gray-400 dark:text-gray-600">Recommended for most users. You don't need to change this.</div>
                            </div>
                          </div>
                        </div>

                        {/* Advanced Settings Toggle */}
                        <div 
                          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showAdvancedSettings ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-400 dark:text-gray-500'}`}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={showAdvancedSettings ? 'animate-pulse' : ''}><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"></path><path d="M12 14V8"></path><path d="M12 18h.01"></path></svg>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900 dark:text-white transition-colors">Advanced Settings</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors">Manual model selection and fine-tuning controls for power users.</div>
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${showAdvancedSettings ? 'bg-indigo-500 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-400'}`}>
                            {showAdvancedSettings ? 'Visible' : 'Hidden'}
                          </div>
                        </div>

                        {showAdvancedSettings && (
                          <div className="flex flex-col gap-6 animate-in slide-in-from-top-4 fade-in duration-300">
                            <div className="flex flex-col gap-4">
                              <div className="flex justify-between items-center mt-2">
                                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest transition-colors duration-300">Advanced Model Selection</h3>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Lookup model..." 
                                        className="text-xs border border-gray-200 dark:border-white/10 dark:bg-white/5 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none w-48 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-all shadow-sm"
                                        value={modelSearch}
                                        onChange={(e) => setModelSearch(e.target.value)}
                                    />
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="absolute right-3 top-2.5 text-gray-400 dark:text-gray-600"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </div>
                              </div>
                              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {[
                                  { id: "OPENAI", name: "GPT-4o", tag: "Flagship", desc: "Most balanced for reasoning and creativity." },
                                  { id: "OPENAI_MINI", name: "GPT-4o Mini", tag: "Fast", desc: "Lightweight and incredibly fast." },
                                  { id: "CLAUDE", name: "Claude 3.5 Sonnet", tag: "Nuanced", desc: "Best-in-class for natural writing tone." },
                                  { id: "CLAUDE_OPUS", name: "Claude 3 Opus", tag: "Heavy", desc: "Maximum reasoning for complex tasks." },
                                  { id: "GEMINI", name: "Gemini 1.5 Pro", tag: "Context", desc: "Huge context window for long documents." },
                                  { id: "GEMINI_FLASH", name: "Gemini 1.5 Flash", tag: "Speed", desc: "Optimized for high-speed small tasks." },
                                  { id: "PERPLEXITY", name: "Perplexity Online", tag: "Search", desc: "Llama 3 with real-time web access." },
                                  { id: "GROQ_LLAMA_405B", name: "Llama 3.1 405B (Groq)", tag: "Massive", desc: "State-of-the-art open weight model." },
                                  { id: "GROQ_LLAMA_70B", name: "Llama 3.1 70B (Groq)", tag: "Instant", desc: "Fastest 70B model available." },
                                  { id: "MISTRAL_LARGE", name: "Mistral Large 2", tag: "Code", desc: "Excellent for logic and multilingual tasks." },
                                  { id: "DEEPSEEK_V2", name: "DeepSeek V2.5", tag: "Logic", desc: "Superior for coding and math." },
                                  { id: "COMMAND_R", name: "Command R+", tag: "RAG", desc: "Optimized for enterprise workflows." },
                                  { id: "OLLAMA", name: "Local Llama (Ollama)", tag: "Private", desc: "Runs 100% on your machine." }
                                ].filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase())).map(model => (
                                  <label 
                                    key={model.id} 
                                    className={`flex items-start gap-3 p-4 border-2 rounded-2xl cursor-pointer transition-all ${llmPreference === model.id ? 'border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5' : 'border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10'}`}
                                  >
                                    <input 
                                      type="radio" 
                                      name="model" 
                                      className="mt-1 accent-indigo-600" 
                                      checked={llmPreference === model.id}
                                      onChange={() => setLLMPreference(model.id as any)}
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900 dark:text-white">{model.name}</span>
                                        {model.tag && <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 text-[9px] font-black uppercase tracking-widest rounded-md">{model.tag}</span>}
                                      </div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{model.desc}</p>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {llmPreference === 'OLLAMA' && (
                              <div className="p-6 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-[2rem] space-y-5 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Ollama Configuration & Test Console</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Configure your local server and perform high-speed latency tests.</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1.5 pl-1">Server URL</label>
                                    <div className="flex gap-2">
                                      <input 
                                        type="text" 
                                        value={ollamaUrl} 
                                        onChange={(e) => setOllamaUrl(e.target.value)}
                                        className="flex-1 text-xs border border-gray-200 dark:border-white/10 dark:bg-black rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                                        placeholder="http://localhost:11434"
                                      />
                                      <button 
                                        onClick={handleFetchOllamaModels}
                                        disabled={isFetchingModels}
                                        className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-xs font-bold rounded-xl hover:opacity-90 transition-all shrink-0 shadow-sm disabled:opacity-50"
                                      >
                                        {isFetchingModels ? "Connecting..." : "Connect"}
                                      </button>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1.5 pl-1">Model Selection</label>
                                    <div className="relative">
                                      <select 
                                        value={ollamaModel}
                                        onChange={(e) => setOllamaModel(e.target.value)}
                                        className="w-full text-xs border border-gray-200 dark:border-white/10 dark:bg-black rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all shadow-sm appearance-none"
                                      >
                                        {ollamaModels.map(m => (
                                          <option key={m} value={m}>{m}</option>
                                        ))}
                                      </select>
                                      <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Connection Status Indicator */}
                                {ollamaStatus === 'connected' && (
                                  <div className="p-3 bg-green-500/10 border border-green-500/25 text-green-700 dark:text-green-400 text-xs rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    <span>Successfully connected to local Ollama server! Dynamic model discovery complete ({ollamaModels.length} models discovered).</span>
                                  </div>
                                )}
                                {ollamaStatus === 'error' && (
                                  <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-400 text-xs rounded-xl space-y-1 animate-in fade-in duration-200">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                      <span className="font-bold">Connection Failed</span>
                                    </div>
                                    <p className="pl-4 leading-normal">{ollamaStatusError}</p>
                                    <p className="pl-4 text-[10px] text-gray-400">Note: Ensure Ollama is running and CORS is configured (e.g., set OLLAMA_ORIGINS="*" as environment variable before running Ollama).</p>
                                  </div>
                                )}

                                {/* Test Generation Box */}
                                <div className="border-t border-indigo-100/50 dark:border-indigo-900/30 pt-4 space-y-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-400 uppercase tracking-wider">High-Speed Prompt Gen Test</span>
                                    {testLatency && (
                                      <span className="text-[10px] font-mono bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                                        Latency: {testLatency}ms
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <input 
                                      type="text"
                                      value={testPrompt}
                                      onChange={(e) => setTestPrompt(e.target.value)}
                                      placeholder="Ex: Summarize AI in three words."
                                      className="flex-1 text-xs border border-gray-200 dark:border-white/10 dark:bg-black rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                                    />
                                    <button 
                                      onClick={handleTestOllama}
                                      disabled={isTestingOllama || !testPrompt.trim()}
                                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 shrink-0"
                                    >
                                      {isTestingOllama ? "Running..." : "Test Rewrite"}
                                    </button>
                                  </div>
                                  {testResponse && (
                                    <div className="p-4 bg-white/40 dark:bg-black/20 rounded-2xl border border-gray-200/50 dark:border-white/5 space-y-1 max-h-[150px] overflow-y-auto">
                                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Ollama Output:</div>
                                      <p className="text-xs text-gray-800 dark:text-gray-200 font-serif leading-relaxed whitespace-pre-wrap">{testResponse}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {(llmPreference === 'GEMINI' || llmPreference === 'GEMINI_FLASH') && (
                              <div className="p-6 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-[2rem] space-y-5 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline></svg>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Google Gemini Configuration</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Configure your Gemini API access and test the connection.</p>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1.5 pl-1">Gemini API Key</label>
                                    <input 
                                      type="password" 
                                      value={geminiApiKey} 
                                      onChange={(e) => setGeminiApiKey(e.target.value)}
                                      className="w-full text-xs font-mono border border-gray-200 dark:border-white/10 dark:bg-black rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                                      placeholder={import.meta.env.VITE_GEMINI_API_KEY ? "Using VITE_GEMINI_API_KEY from environment" : "Paste your AIzaSy... API Key"}
                                    />
                                  </div>

                                  <div className="p-3.5 bg-white/40 dark:bg-black/20 rounded-2xl border border-gray-200/50 dark:border-white/5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                    <span className="font-bold text-gray-900 dark:text-white block mb-1">Testing Information:</span>
                                    You can test prompt generation instantly using this key by clicking on the new <strong>Prompt Studio</strong> section in the sidebar. Highlight any text and press <strong>Ctrl + P</strong> to activate the overlay rewrites!
                                  </div>
                                </div>
                              </div>
                            )}

                            {(llmPreference === 'OPENAI' || llmPreference === 'OPENAI_MINI') && (
                              <div className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-[2rem] space-y-5 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">OpenAI API Configuration</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Configure your GPT-4o / GPT-4o Mini API Key.</p>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1.5 pl-1">OpenAI API Key</label>
                                    <input 
                                      type="password" 
                                      value={openaiApiKey} 
                                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                                      className="w-full text-xs font-mono border border-gray-200 dark:border-white/10 dark:bg-black rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                                      placeholder={import.meta.env.VITE_OPENAI_API_KEY ? "Using VITE_OPENAI_API_KEY from environment" : "Paste your sk-proj-... API Key"}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {(llmPreference === 'CLAUDE' || llmPreference === 'CLAUDE_OPUS') && (
                              <div className="p-6 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-[2rem] space-y-5 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Anthropic Claude Configuration</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Configure your Claude 3.5 Sonnet / Claude 3 Opus Key.</p>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1.5 pl-1">Claude API Key</label>
                                    <input 
                                      type="password" 
                                      value={claudeApiKey} 
                                      onChange={(e) => setClaudeApiKey(e.target.value)}
                                      className="w-full text-xs font-mono border border-gray-200 dark:border-white/10 dark:bg-black rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                                      placeholder={import.meta.env.VITE_CLAUDE_API_KEY ? "Using VITE_CLAUDE_API_KEY from environment" : "Paste your sk-ant-... API Key"}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="p-6 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-[2rem] transition-all duration-300">
                              <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Precision Controls</h3>
                              <div className="space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                  <div className="relative flex items-center justify-center">
                                    <input type="checkbox" defaultChecked className="peer appearance-none w-5 h-5 border-2 border-gray-300 dark:border-white/10 rounded-lg checked:bg-indigo-600 checked:border-indigo-600 transition-all" />
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                  </div>
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Allow Prompt X to dynamically override model choice</span>
                                </label>
                                <label className="flex items-center gap-3 opacity-40 cursor-not-allowed">
                                  <div className="w-5 h-5 border-2 border-gray-200 dark:border-white/10 rounded-lg"></div>
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Force global model consistency across all sub-tasks</span>
                                </label>
                              </div>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-6 italic">Changing these settings may affect rewrite quality and system latency.</p>
                            </div>
                          </div>
                        )}

                        {/* Footer Guidance */}
                        <div className="border-t border-gray-100 pt-6 pb-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Need more control?</h4>
                          <div className="flex gap-4">
                            <button onClick={() => setSettingsTab('Modes')} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">Customize mode behavior</button>
                            {/* Pro link with no action for now */}
                            <button className="text-sm text-blue-600 hover:text-blue-700 hover:underline">Create custom modes (Pro)</button>
                            <button className="text-sm text-blue-600 hover:text-blue-700 hover:underline">Run models locally</button>
                          </div>
                        </div>
                      </>
                    )}
                    {settingsTab === 'Modes' && (
                      <>
                        <div><h2 className="text-2xl font-serif text-gray-900">Modes Settings</h2><p className="text-gray-500 mt-1">Customize prompt behaviors and defaults.</p></div>

                        {/* Default Mode + Summary Split */}
                        <div className="flex gap-6 items-start">
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Default Mode</h3>
                            <div className="space-y-2">
                              {modes.map(mode => (
                                <label 
                                  key={mode.name} 
                                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all group ${activeMode === mode.name ? 'border-blue-500 bg-blue-50/20' : 'border-gray-200 hover:bg-gray-50'}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <input 
                                      type="radio" 
                                      name="default_mode" 
                                      checked={activeMode === mode.name} 
                                      onChange={() => setActiveMode(mode.name)}
                                      className="text-blue-600 focus:ring-blue-500" 
                                    />
                                    <span className="text-sm font-medium text-gray-900">{mode.name}</span>
                                    {mode.recommended && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase">Recommended</span>}
                                  </div>
                                </label>
                              ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-2 ml-1">"Recommended" is best for most users and general writing tasks.</p>
                          </div>

                          {/* Mode Summary Panel (Static implementation for Creative for now as requested) */}
                          <div className="w-64 bg-gray-50 border border-gray-100 rounded-xl p-5 sticky top-0">
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Active Mode</div>
                            <div className="text-lg font-serif text-gray-900 mb-4">{activeMode}</div>

                            <div className="space-y-4">
                              <div>
                                <h4 className="text-xs font-semibold text-gray-900 mb-1">What it does</h4>
                                <ul className="text-xs text-gray-600 space-y-1 list-disc pl-3">
                                  <li>Tailored for {activeMode.toLowerCase()} intent</li>
                                  <li>Optimizes tone and verbosity</li>
                                  <li>Applies specialized context</li>
                                </ul>
                              </div>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg">
                                 <p className="text-[10px] text-gray-500 leading-tight">
                                    "Prompt X will use the {activeMode} persona for all global rewrites."
                                 </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-100 pt-6">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold text-gray-900">Custom Modes <span className="text-indigo-600 text-xs ml-1 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">PRO</span></h3>
                            {isCreatingMode && (
                                <button 
                                    onClick={() => setIsCreatingMode(false)}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                >
                                    Cancel
                                </button>
                            )}
                          </div>
                          
                          {!isCreatingMode ? (
                              <>
                                <p className="text-sm text-gray-500 mb-3">Design your own prompt behavior with system instructions, tone rules, and output style.</p>
                                <ul className="flex gap-4 mb-4">
                                    {['Brand voice', 'Personal workflow', 'Team standards'].map(hint => (
                                    <li key={hint} className="text-xs text-gray-400 flex items-center gap-1">
                                        <div className="w-1 h-1 bg-gray-300 rounded-full"></div> {hint}
                                    </li>
                                    ))}
                                </ul>
                                <button 
                                    onClick={() => setIsCreatingMode(true)}
                                    className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 font-medium hover:border-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    + Create Custom Mode
                                </button>
                              </>
                          ) : (
                              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4 animate-in zoom-in-95 duration-200">
                                  <div>
                                      <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Mode Name</label>
                                      <input value={customModeName} onChange={(e) => setCustomModeName(e.target.value)} type="text" placeholder="e.g. My Brand Voice" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500" />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">System Instructions</label>
                                      <textarea value={customModeInstructions} onChange={(e) => setCustomModeInstructions(e.target.value)} placeholder="Tell the AI how to behave..." className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 h-24 resize-none" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                      <div>
                                          <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Tone</label>
                                          <select value={customModeTone} onChange={(e) => setCustomModeTone(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 outline-none">
                                              <option>Professional</option>
                                              <option>Casual</option>
                                              <option>Humorous</option>
                                              <option>Direct</option>
                                          </select>
                                      </div>
                                      <div>
                                          <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Output Style</label>
                                          <select value={customModeStyle} onChange={(e) => setCustomModeStyle(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 outline-none">
                                              <option>Concise</option>
                                              <option>Detailed</option>
                                              <option>Bullet Points</option>
                                          </select>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      const name = customModeName.trim();
                                      const systemPrompt = customModeInstructions.trim();
                                      if (!name || !systemPrompt) return;
                                      addCustomMode({ name, systemPrompt, tone: customModeTone, verbosity: customModeStyle, temperature: customModeTone === 'Humorous' ? 0.8 : 0.4 });
                                      setActiveMode(name);
                                      setCustomModeName('');
                                      setCustomModeInstructions('');
                                      setIsCreatingMode(false);
                                    }}
                                    disabled={!customModeName.trim() || !customModeInstructions.trim()}
                                    className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors"
                                  >
                                    Save Custom Mode
                                  </button>
                              </div>
                          )}
                        </div>

                        <div className="border-t border-gray-100 dark:border-white/5 pt-6 transition-colors duration-300">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Behavior</h3>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mb-5 transition-colors duration-300">These settings control how Prompt X rewrites text when you use the shortcut.</p>

                          <div className="space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={autoEnhance} 
                                onChange={(e) => setAutoEnhance(e.target.checked)}
                                className="rounded border-gray-300 dark:border-white/10 dark:bg-white/5 text-blue-600 focus:ring-blue-500" 
                              />
                              <div>
                                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors">Auto-enhance by default</span>
                              </div>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={askBeforeRewrite} 
                                onChange={(e) => setAskBeforeRewrite(e.target.checked)}
                                className="rounded border-gray-300 dark:border-white/10 dark:bg-white/5 text-blue-600 focus:ring-blue-500" 
                              />
                              <div>
                                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors">Ask before rewriting</span>
                                <p className="text-xs text-gray-400 dark:text-gray-500">You'll see a preview before changes are applied.</p>
                              </div>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={keepOriginalText} 
                                onChange={(e) => setKeepOriginalText(e.target.checked)}
                                className="rounded border-gray-300 dark:border-white/10 dark:bg-white/5 text-blue-600 focus:ring-blue-500" 
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors">Keep original text</span>
                            </label>
                          </div>
                        </div>
                      </>
                    )}
                    {settingsTab === 'Shortcuts' && (
                      <>
                        <div className="flex justify-between items-start">
                          <div><h2 className="text-2xl font-serif text-gray-900 dark:text-white transition-colors duration-300">Shortcuts</h2><p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors duration-300">Manage global shortcuts and quick actions.</p></div>
                          <label className="flex items-center gap-3 cursor-pointer group bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 px-4 py-2 rounded-2xl transition-all">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">Enable global shortcuts</span>
                            <div className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={enableGlobalShortcuts} 
                                onChange={(e) => setEnableGlobalShortcuts(e.target.checked)}
                                className="sr-only peer" 
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                            </div>
                          </label>
                        </div>

                        {/* How it works */}
                        <div className="bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-5 transition-colors duration-300">
                          <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            </div>
                            <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
                              <span className="font-bold">How it works:</span> Use keyboard shortcuts to rewrite text instantly in any app. Highlight text → Press shortcut → AI does the rest.
                            </p>
                          </div>
                        </div>

                        <div className={!enableGlobalShortcuts ? "opacity-40 pointer-events-none grayscale transition-all duration-300" : "transition-all duration-300"}>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-widest">Global Shortcut</h3>
                          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-6 shadow-sm flex items-center justify-between transition-colors duration-300">
                            <div>
                              <div className="text-lg font-bold text-gray-900 dark:text-white mb-1 transition-colors duration-300">Rewrite selection</div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm transition-colors duration-300">Uses your default mode to enhance any selected text.</p>
                            </div>
                            <div className="flex flex-col items-end gap-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-black bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-2 rounded-xl text-gray-800 dark:text-white shadow-sm transition-colors duration-300">
                                  {rewriteShortcut}
                                </span>
                              </div>
                              <button 
                                onClick={() => {
                                  const newVal = prompt("Enter new shortcut (e.g. Ctrl + Shift + P):", rewriteShortcut);
                                  if (newVal) setRewriteShortcut(newVal);
                                }}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className={!enableGlobalShortcuts ? "opacity-40 pointer-events-none grayscale transition-all duration-300 mt-6" : "transition-all duration-300 mt-6"}>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 uppercase tracking-widest">Quick Actions <span className="font-normal text-gray-400 dark:text-gray-600 lowercase">(Optional)</span></h3>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mb-5 transition-colors duration-300">Force a specific action without opening the dashboard.</p>

                          <div className="space-y-3">
                            {[
                              { name: 'Rewrite', value: rewriteShortcut, setter: setRewriteShortcut, desc: 'Uses current active mode' },
                              { name: 'Shorten', value: shortenShortcut, setter: setShortenShortcut, desc: 'Forces concise output' },
                              { name: 'Expand', value: expandShortcut, setter: setExpandShortcut, desc: 'Adds detail & examples' }
                            ].map(action => (
                              <div key={action.name} className="flex items-center justify-between p-4 border border-gray-200 dark:border-white/5 rounded-2xl bg-white dark:bg-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-all group">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-black/20 flex items-center justify-center text-gray-400 group-hover:text-indigo-500 transition-colors">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold text-gray-900 dark:text-white transition-colors duration-300">{action.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-500 transition-colors duration-300">{action.desc}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-[10px] font-bold bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/5 px-2 py-1 rounded-lg text-gray-600 dark:text-gray-400">
                                    {action.value}
                                  </span>
                                  <button 
                                    onClick={() => {
                                      const newVal = prompt(`Enter new shortcut for ${action.name}:`, action.value);
                                      if (newVal) action.setter(newVal);
                                    }}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-300 hover:text-gray-600 dark:hover:text-white transition-colors"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121(0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Safety & Privacy */}
                        <div className="mt-8 border-t border-gray-100 dark:border-white/5 pt-8 transition-colors duration-300">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-widest flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            Safety & Privacy
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { title: 'No Keystroke Capture', desc: 'Prompt X never captures or logs what you type.' },
                                { title: 'Selection Activated', desc: 'Shortcuts only trigger when text is explicitly selected.' },
                                { title: 'Local Privacy', desc: 'Processing happens in isolated, secure sessions.' },
                                { title: 'Kill Switch', desc: 'Disable all shortcuts instantly with the master toggle above.' }
                            ].map(item => (
                                <div key={item.title} className="p-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl transition-colors duration-300">
                                    <div className="text-xs font-bold text-gray-900 dark:text-white mb-1">{item.title}</div>
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</div>
                                </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    {settingsTab === 'Privacy' && (
                      <>
                        <div><h2 className="text-2xl font-serif text-gray-900 dark:text-white transition-colors duration-300">Privacy</h2><p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors duration-300">Control your data and history retention.</p></div>
                        
                        <div className="space-y-8">
                          {/* Data Usage Section */}
                          <section>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-widest">Data Usage</h3>
                            <div className="space-y-4">
                              <label className="flex items-center gap-4 cursor-pointer group">
                                <div className="relative inline-flex items-center">
                                  <input 
                                    type="checkbox" 
                                    checked={improveApp} 
                                    onChange={(e) => setImproveApp(e.target.checked)}
                                    className="sr-only peer" 
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 transition-all"></div>
                                </div>
                                <div className="flex-1">
                                  <span className="text-sm font-bold text-gray-900 dark:text-white transition-colors">Improve Prompt X using anonymous data</span>
                                  <p className="text-xs text-gray-500 dark:text-gray-500">Share non-personal usage patterns to help us optimize performance.</p>
                                </div>
                              </label>

                              <label className="flex items-center gap-4 cursor-pointer group">
                                <div className="relative inline-flex items-center">
                                  <input 
                                    type="checkbox" 
                                    checked={storeLocallyOnly} 
                                    onChange={(e) => setStoreLocallyOnly(e.target.checked)}
                                    className="sr-only peer" 
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 transition-all"></div>
                                </div>
                                <div className="flex-1">
                                  <span className="text-sm font-bold text-gray-900 dark:text-white transition-colors">Store prompt history locally only</span>
                                  <p className="text-xs text-gray-500 dark:text-gray-500">Keep history on this device. Prompt X does not provide cloud sync.</p>
                                </div>
                              </label>
                            </div>
                          </section>

                          {/* Prompt History Section */}
                          <section className="border-t border-gray-100 dark:border-white/5 pt-8 transition-colors duration-300">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-widest">Prompt History</h3>
                            <div className="space-y-4">
                              <label className="flex items-center gap-4 cursor-pointer group">
                                <div className="relative inline-flex items-center">
                                  <input 
                                    type="checkbox" 
                                    checked={saveHistory} 
                                    onChange={(e) => setSaveHistory(e.target.checked)}
                                    className="sr-only peer" 
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 transition-all"></div>
                                </div>
                                <div className="flex-1">
                                  <span className="text-sm font-bold text-gray-900 dark:text-white transition-colors">Save prompt history</span>
                                  <p className="text-xs text-gray-500 dark:text-gray-500">Keep a log of your improved text for later reference.</p>
                                </div>
                              </label>

                              <label className={`flex items-center gap-4 cursor-pointer group transition-opacity duration-300 ${!saveHistory ? 'opacity-40 pointer-events-none' : ''}`}>
                                <div className="relative inline-flex items-center">
                                  <input 
                                    type="checkbox" 
                                    checked={autoDeleteHistory} 
                                    onChange={(e) => setAutoDeleteHistory(e.target.checked)}
                                    className="sr-only peer" 
                                  />
                                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 transition-all"></div>
                                </div>
                                <div className="flex-1">
                                  <span className="text-sm font-bold text-gray-900 dark:text-white transition-colors">Auto-delete after 30 days</span>
                                  <p className="text-xs text-gray-500 dark:text-gray-500">Automatically prune old history items to save space.</p>
                                </div>
                              </label>
                            </div>
                          </section>

                          {/* Local Models Warning */}
                          <section className="border-t border-gray-100 dark:border-white/5 pt-8 pb-4 transition-colors duration-300">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-widest">Local Models</h3>
                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl p-5 flex gap-4 transition-colors duration-300 group hover:border-amber-300 transition-all">
                              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                              </div>
                              <div className="flex-1">
                                <span className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-tighter">⚠ Experimental</span>
                                <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed mt-1">
                                  Local models run entirely on your device for maximum privacy. They require significant CPU/RAM and may cause performance degradation during processing.
                                </p>
                              </div>
                            </div>
                          </section>
                        </div>
                      </>
                    )}
                    {false && settingsTab === 'Billing' && (
                      <div className="flex flex-col gap-8 transition-all duration-300">
                        <div className="flex justify-between items-center">
                          <div>
                            <h2 className="text-2xl font-serif text-gray-900 dark:text-white transition-colors">Billing & Usage</h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">Manage your subscription and monitor AI consumption.</p>
                          </div>
                        </div>

                        {/* Plan Status Card */}
                        <div className="p-6 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/5 rounded-[2rem] shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 transition-colors duration-300 overflow-hidden relative">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                          <div className="flex items-center gap-5">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${plan === 'PRO' ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600'}`}>
                              {plan === 'PRO' ? (
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                              ) : (
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Current Plan</div>
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">Prompt X {plan}</span>
                                {plan === 'PRO' && <span className="px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-black uppercase rounded-full">Active</span>}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-4">
                            {plan === 'FREE' ? (
                              <button 
                                onClick={() => setPlan('PRO')}
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-2xl shadow-xl shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                              >
                                Upgrade to PRO
                              </button>
                            ) : (
                              <button 
                                onClick={() => setPlan('FREE')}
                                className="px-8 py-3 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 text-sm font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                              >
                                Manage Subscription
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Unified Usage Dashboard */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Usage Limits */}
                          <div className="p-6 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/5 rounded-[2rem] shadow-sm transition-colors duration-300">
                            <div className="flex justify-between items-center mb-6">
                              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Monthly Usage</h3>
                              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-full uppercase">Resets in 12 days</span>
                            </div>
                            <div className="space-y-6">
                              <div>
                                <div className="flex justify-between text-sm mb-2">
                                  <span className="text-gray-600 dark:text-gray-400 font-medium">AI Rewrites</span>
                                  <span className="font-bold text-gray-900 dark:text-white">{stats.optimizedRequests} <span className="text-gray-400 dark:text-gray-600 font-normal">/ {plan === 'PRO' ? 'Unlimited' : '100'}</span></span>
                                </div>
                                <div className="w-full h-2.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-1000" style={{ width: `${plan === 'PRO' ? 45 : stats.optimizedRequests}%` }}></div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                  { label: 'Prompt history', val: '12 / 20', locked: false },
                                  { label: 'Custom modes', val: 'PRO Required', locked: plan === 'FREE' }
                                ].map(item => (
                                  <div key={item.label} className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 transition-colors duration-300">
                                    <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{item.label}</div>
                                    <div className={`text-sm font-bold ${item.locked ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'}`}>
                                      {item.locked ? (
                                        <span className="flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Locked</span>
                                      ) : item.val}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Model Optimization Stats */}
                          <div className="p-6 bg-black dark:bg-[#1a1a1a] rounded-[2rem] text-white shadow-2xl transition-colors duration-300 overflow-hidden relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-purple-600/10 opacity-50"></div>
                            <div className="relative z-10">
                              <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-1">Savings Impact</h3>
                                    <p className="text-[10px] text-gray-400">Powered by Prompt X Auto-Routing</p>
                                </div>
                                <div className="bg-indigo-500/20 p-2.5 rounded-xl text-indigo-400 ring-1 ring-indigo-500/30 group-hover:scale-110 transition-transform">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                                    <div className="text-[10px] text-gray-500 uppercase font-black mb-1 text-center tracking-widest">Tokens Saved</div>
                                    <div className="text-2xl font-black text-center text-white">{stats.tokensSaved.toLocaleString()}</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-sm text-center">
                                    <div className="text-[10px] text-gray-500 uppercase font-black mb-1 tracking-widest">Est. Savings</div>
                                    <div className="text-2xl font-black text-green-400">${stats.costSaved.toFixed(2)}</div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Model Distribution</div>
                                  <span className="text-[10px] font-bold text-indigo-300">{stats.optimizedRequests} Requests</span>
                                </div>
                                <div className="space-y-2.5">
                                    {Object.entries(stats.modelUsageBreakdown).map(([model, count]) => (
                                        <div key={model} className="flex items-center justify-between text-[11px] group/item">
                                            <span className="text-gray-400 group-hover/item:text-white transition-colors">{model}</span>
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" style={{ width: `${(count / stats.optimizedRequests) * 100}%` }}></div>
                                                </div>
                                                <span className="text-gray-500 font-bold min-w-[3ch] text-right">{Math.round((count / stats.optimizedRequests) * 100)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Provider Billing Shortcuts */}
                        <div className="p-8 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-[2rem] transition-all duration-300">
                          <div className="flex items-center gap-3 mb-6">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">
                              {llmPreference === 'AUTO' ? 'Provider Billing Dashboards' : 'Active Provider Billing'}
                            </h3>
                            <div className="flex-1 h-px bg-gray-200 dark:bg-white/5"></div>
                          </div>
                          <div className="flex flex-wrap gap-3">
                              {[
                                  { id: 'OPENAI', name: 'OpenAI', url: 'https://platform.openai.com/usage' },
                                  { id: 'CLAUDE', name: 'Anthropic', url: 'https://console.anthropic.com/settings/billing' },
                                  { id: 'GEMINI', name: 'Google Cloud', url: 'https://console.cloud.google.com/billing' },
                                  { id: 'GROQ_LLAMA_405B', name: 'Groq', url: 'https://console.groq.com/billing' },
                                  { id: 'MISTRAL_LARGE', name: 'Mistral', url: 'https://console.mistral.ai/billing/' },
                                  { id: 'DEEPSEEK_V2', name: 'DeepSeek', url: 'https://platform.deepseek.com/billing' }
                              ].filter(p => llmPreference === 'AUTO' || llmPreference === p.id).map(p => (
                                  <a 
                                      key={p.name} 
                                      href={p.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 group ${llmPreference === p.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                                  >
                                      {p.name}
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-40 group-hover:opacity-100 transition-opacity"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 22 3 22 10"></polyline><line x1="10" y1="14" x2="22" y2="2"></line></svg>
                                  </a>
                              ))}
                          </div>
                          {llmPreference === 'AUTO' && (
                              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-4 italic text-center">
                                "Prompt X Auto-Routing intelligently switches providers to maintain the best performance-to-cost ratio."
                              </p>
                          )}
                        </div>
                      </div>
                    )}
                    {settingsTab === 'About' && (
                      <div className="flex flex-col gap-10 pb-10">
                        {/* Hero Brand Identity */}
                        <div className="relative overflow-hidden rounded-[2.5rem] bg-gray-900 dark:bg-white p-1 transition-all duration-500 shadow-2xl">
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-20 animate-pulse"></div>
                          <div className="relative bg-white dark:bg-black rounded-[2.4rem] p-10 flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-gray-900 dark:bg-white rounded-3xl flex items-center justify-center mb-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(255,255,255,0.1)] transform hover:rotate-6 transition-transform cursor-pointer">
                              <span className="text-white dark:text-black text-4xl font-black font-serif">X</span>
                            </div>
                            <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2 font-serif tracking-tight">Prompt X</h2>
                            <div className="flex items-center gap-2 mb-4">
                              <span className="px-3 py-1 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-gray-200 dark:border-white/5">Version 0.1.0</span>
                              <span className="px-3 py-1 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-500/20">Beta</span>
                            </div>
                            <p className="text-xl text-gray-600 dark:text-gray-300 font-medium max-w-sm leading-tight mb-8">
                              The invisible bridge between your <span className="text-gray-900 dark:text-white underline decoration-indigo-500 underline-offset-4">thoughts</span> and the <span className="text-gray-900 dark:text-white underline decoration-purple-500 underline-offset-4">screen</span>.
                            </p>
                            <div className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <span className="text-2xl font-black text-gray-900 dark:text-white">100%</span>
                                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Privacy</span>
                              </div>
                              <div className="w-px h-8 bg-gray-100 dark:bg-white/10 mx-2"></div>
                              <div className="flex flex-col items-center">
                                <span className="text-2xl font-black text-gray-900 dark:text-white">&lt;0.1s</span>
                                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Latency</span>
                              </div>
                              <div className="w-px h-8 bg-gray-100 dark:bg-white/10 mx-2"></div>
                              <div className="flex flex-col items-center">
                                <span className="text-2xl font-black text-gray-900 dark:text-white">∞</span>
                                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Potential</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* The Mission */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="p-8 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-[2rem] transition-colors duration-300">
                            <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4">Our Mission</h3>
                            <p className="text-base text-gray-700 dark:text-gray-300 font-serif leading-relaxed italic">
                              "We believe AI should be a seamless extension of your workflow, not a destination you have to visit. Prompt X brings intelligence to where you already work."
                            </p>
                          </div>
                          <div className="p-8 bg-black dark:bg-white rounded-[2rem] shadow-2xl flex flex-col justify-center">
                             <div className="flex items-center gap-3 mb-2">
                               <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                               <span className="text-[10px] font-black text-white dark:text-black uppercase tracking-widest">Operational Status</span>
                             </div>
                             <h4 className="text-xl font-bold text-white dark:text-black">All Systems Nominal</h4>
                             <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Connected to Global Routing Edge v2.4</p>
                          </div>
                        </div>


                        {/* Privacy Commitment */}
                        <div className="p-8 bg-indigo-600 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl transition-transform group-hover:scale-110"></div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                              <h3 className="text-xl font-bold uppercase tracking-tight">Privacy First Protocol</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                <p className="text-indigo-100 text-sm leading-relaxed">
                                  We built Prompt X with the radical idea that your data belongs to you. Our protocols ensure zero persistent storage of your text by default.
                                </p>
                                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> GDPR & SOC2 COMPLIANT
                                </div>
                              </div>
                              <ul className="space-y-3">
                                {[
                                  'End-to-end encrypted transit',
                                  'Zero-knowledge prompt processing',
                                  'Optional local-only model execution',
                                  'No data telemetry for training'
                                ].map((item, i) => (
                                  <li key={i} className="flex items-center gap-3 text-sm font-medium text-indigo-50">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-300"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Resources */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { name: 'Documentation', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> },
                            { name: 'Security Hub', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> },
                            { name: 'API Docs', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg> },
                            { name: 'Twitter / X', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg> }
                          ].map(link => (
                            <button key={link.name} className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-3xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-xl transition-all group">
                              <div className="text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">{link.icon}</div>
                              <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{link.name}</span>
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-col items-center pt-8 pb-4 border-t border-gray-100 dark:border-white/5 mt-4">
                          <p className="text-[10px] text-gray-400 dark:text-gray-600 font-black uppercase tracking-[0.3em] mb-2">Developed in London • San Francisco • Bangalore</p>
                          <p className="text-xs text-gray-300 dark:text-gray-700 font-serif italic">"Building the future of human-AI collaboration."</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

      )}

    </div>
  );
}

export default App;
