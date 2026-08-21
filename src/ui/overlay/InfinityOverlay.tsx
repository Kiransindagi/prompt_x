import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OverlayShell } from './OverlayShell';
import { useOverlayStore } from '../../store/overlayStore';
import { useSettingsStore } from '../../store/settingsStore';
import { invokeBot } from '../../core/invokeBot';
import { refineResponse } from '../../core/promptBrain/refine';

export function InfinityOverlay() {
    const { state: overlayState, isVisible, payload, setThinking, setExpanded, hideOverlay, updatePayload } = useOverlayStore();
    const { setShowDashboard } = useSettingsStore();
    const [refineInput, setRefineInput] = useState("");
    const [promptInput, setPromptInput] = useState("");
    const [isMouseDownOnDragHandle, setIsMouseDownOnDragHandle] = useState(false);

    // Auto-Sequence: Idle → Thinking (600ms so the ∞ appear animation plays first)
    useEffect(() => {
        if (overlayState === 'idle' && payload.originalText) {
            // If user starts a new task, ensure the dashboard is tucked away
            setShowDashboard(false);
            const timer = setTimeout(() => setThinking(), 600);
            return () => clearTimeout(timer);
        }
    }, [overlayState, payload.originalText, setThinking, setShowDashboard]);

    // Handle clicking outside to dismiss
    useEffect(() => {
        const handleBlur = () => {
            if (isVisible && !isMouseDownOnDragHandle) {
                hideOverlay();
            }
        };
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, [isVisible, hideOverlay, isMouseDownOnDragHandle]);

    // Handle cleaning up the drag handle state globally
    useEffect(() => {
        if (isMouseDownOnDragHandle) {
            const handleMouseUp = () => {
                setIsMouseDownOnDragHandle(false);
            };
            window.addEventListener('mouseup', handleMouseUp);
            return () => window.removeEventListener('mouseup', handleMouseUp);
        }
    }, [isMouseDownOnDragHandle]);

    // Thinking → call the brain → Expanded
    useEffect(() => {
        if (overlayState === 'thinking' && payload.originalText) {
            invokeBot(payload.originalText, payload.action);
        }
    }, [overlayState, payload.originalText]);

    const handleRefine = async () => {
        if (!refineInput.trim()) return;
        setThinking();
        const refineRequestId = useOverlayStore.getState().requestId;
        try {
            const refined = await refineResponse(payload.resultText || "", refineInput);
            setExpanded(refined, undefined, refineRequestId);
        } catch (e) {
            console.error("Refine error", e);
        }
        setRefineInput("");
    };

    const handleSymbolClick = () => {
        if (overlayState === 'idle' && payload.originalText) setThinking();
    };

    const handlePromptSubmit = () => {
        const text = promptInput.trim();
        if (!text) return;
        updatePayload({ originalText: text, action: 'rewrite' });
        setThinking();
        setPromptInput('');
    };

    if (!isVisible) return null;

    return (
        <div className="font-sans">
            <AnimatePresence mode="wait">

                {/* ── IDLE & THINKING: Infinity Symbol (Near Cursor) ─────────────────── */}
                {(overlayState === 'idle' || overlayState === 'thinking') && (
                    <OverlayShell key="symbol-shell">
                        <motion.div
                            key="symbol"
                            className="w-28 h-14 cursor-pointer relative flex items-center justify-center p-2 rounded-full"
                            onClick={handleSymbolClick}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 2, filter: 'blur(10px)' }}
                            whileHover={{ scale: 1.1 }}
                        >
                            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                            <svg viewBox="0 0 100 50" className="w-full h-full drop-shadow-[0_0_10px_rgba(59,130,246,0.6)] z-10">
                                <defs>
                                    <linearGradient id="inf-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#60a5fa" />
                                        <stop offset="50%" stopColor="#a78bfa" />
                                        <stop offset="100%" stopColor="#f472b6" />
                                    </linearGradient>
                                </defs>
                                <motion.path
                                    d="M20,25 C20,10 40,10 50,25 C60,40 80,40 80,25 C80,10 60,10 50,25 C40,40 20,40 20,25 Z"
                                    fill="none"
                                    stroke="url(#inf-grad)"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1, strokeWidth: overlayState === 'thinking' ? 6 : 5 }}
                                    transition={{ pathLength: { duration: 0.8, ease: "easeOut" }, opacity: { duration: 0.5 } }}
                                />
                                {overlayState === 'thinking' && (
                                    <motion.path
                                        d="M20,25 C20,10 40,10 50,25 C60,40 80,40 80,25 C80,10 60,10 50,25 C40,40 20,40 20,25 Z"
                                        fill="none"
                                        stroke="url(#inf-grad)"
                                        strokeWidth="4"
                                        initial={{ pathOffset: 0 }}
                                        animate={{ pathOffset: 1 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    />
                                )}
                            </svg>
                        </motion.div>
                        {overlayState === 'idle' && !payload.originalText && (
                            <div className="mt-3 w-[360px] rounded-2xl bg-white/95 dark:bg-[#1a1a1a] p-3 shadow-xl border border-gray-200 dark:border-white/10">
                                <input autoFocus value={promptInput} onChange={(e) => setPromptInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePromptSubmit()} placeholder="What would you like to improve?" className="w-full bg-transparent outline-none text-sm text-gray-800 dark:text-white" />
                                <button onClick={handlePromptSubmit} disabled={!promptInput.trim()} className="mt-2 w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white disabled:opacity-40">Generate</button>
                            </div>
                        )}
                    </OverlayShell>
                )}

                {/* ── EXPANDED: Result Card (Relative to Selection) ──────────────────────────── */}
                {overlayState === 'expanded' && (
                    <OverlayShell key="expanded-shell">
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white/80 dark:bg-[#1a1a1ae6] backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] dark:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col pointer-events-auto w-[600px] transition-colors duration-300 ring-1 ring-black/5 dark:ring-white/5"
                            style={{ maxHeight: '70vh' }}
                        >
                            {/* Drag handle */}
                            <div 
                                data-tauri-drag-region 
                                className="h-7 flex items-center justify-center cursor-grab active:cursor-grabbing bg-white/30 border-b border-gray-100/60 shrink-0 select-none"
                                onMouseDown={() => setIsMouseDownOnDragHandle(true)}
                            >
                                <div data-tauri-drag-region className="w-12 h-1 rounded-full bg-gray-300/80 pointer-events-none" />
                            </div>

                            {/* Consolidated Single Card Content */}
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white/40 dark:bg-black/20">
                                {/* Active Suggestion Area */}
                                <div className="flex-1 overflow-y-auto p-8">
                                    <span className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 uppercase tracking-widest block mb-4 flex items-center gap-2">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="url(#inf-grad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                                        AI Suggestion
                                    </span>
                                    <p className="text-[15px] text-gray-800 dark:text-gray-200 font-normal leading-relaxed font-sans whitespace-pre-wrap tracking-wide selection:bg-blue-200 dark:selection:bg-blue-900">
                                        {payload.resultText}
                                    </p>
                                </div>
                            </div>

                            {/* Refine bar */}
                            <div className="shrink-0 px-7 py-4 flex gap-3 items-center border-t border-gray-100/50 dark:border-white/5 bg-white/70 dark:bg-white/5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-sm shrink-0 shadow-lg shadow-blue-500/30">∞</div>
                                <input
                                    type="text"
                                    placeholder="Refine this suggestion..."
                                    className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-[14px] text-gray-800 dark:text-gray-200 font-medium"
                                    value={refineInput}
                                    onChange={(e) => setRefineInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                                />
                                <button onClick={handleRefine} className="p-2.5 bg-gray-100 dark:bg-white/10 rounded-full text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/20 transition-all">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                                </button>
                            </div>

                            {/* Footer actions */}
                            <div className="h-14 border-t border-gray-100/60 dark:border-white/10 flex items-center justify-between px-7 bg-gray-50/80 dark:bg-black/40 shrink-0">
                                <div className="flex items-center gap-3">
                                    <button 
                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full transition-all"
                                        title="Settings"
                                        onClick={() => {
                                            hideOverlay();
                                            setShowDashboard(true);
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => {
                                        hideOverlay();
                                        setShowDashboard(false);
                                    }} 
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-all" 
                                    title="Dismiss"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                </button>
                                <button
                                    className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all"
                                    title="Copy to clipboard"
                                    onClick={() => navigator.clipboard.writeText(payload.resultText || '')}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                </button>
                                <button
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(payload.resultText || ''); 
                                        hideOverlay(); 
                                        setShowDashboard(false);
                                        if ((window as any).__TAURI_INTERNALS__) {
                                            const { getCurrentWindow } = await import('@tauri-apps/api/window');
                                            await getCurrentWindow().hide();
                                            const { invoke } = await import('@tauri-apps/api/core');
                                            await invoke('simulate_paste');
                                        }
                                    }}
                                    className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-full text-[13px] font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all flex items-center gap-2 tracking-wide"
                                    title="Accept & Paste"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                    Accept
                                </button>
                                </div>
                            </div>
                        </motion.div>
                    </OverlayShell>
                )}

            </AnimatePresence>
        </div>
    );
}
