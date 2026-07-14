import { create } from 'zustand';
import { OverlayState, OverlayPayload } from '../ui/overlay/OverlayState';

interface OverlayStore {
    isVisible: boolean;
    state: OverlayState;
    anchorPosition: { x: number; y: number };
    payload: OverlayPayload;

    // Actions
    showOverlay: (position: { x: number; y: number }, originalText: string) => void;
    setThinking: () => void;
    setExpanded: (resultText: string, analysis?: any) => void;
    setIdle: () => void;
    hideOverlay: () => void;
    updatePayload: (updates: Partial<OverlayPayload>) => void;
}
 
export const useOverlayStore = create<OverlayStore>((set) => ({
    isVisible: false,
    state: 'hidden',
    anchorPosition: { x: 0, y: 0 },
    payload: { originalText: '' },
 
    showOverlay: (position, originalText) => set({
        isVisible: true,
        state: 'idle',
        anchorPosition: position,
        payload: { originalText }
    }),
 
    setThinking: () => set({ state: 'thinking' }),
 
    setExpanded: (resultText, analysis) => set((prev) => ({
        state: 'expanded',
        payload: { ...prev.payload, resultText, analysis }
    })),

    setIdle: () => set({ state: 'idle' }),

    hideOverlay: () => set({
        isVisible: false,
        state: 'hidden',
        payload: { originalText: '' }
    }),

    updatePayload: (updates) => set((prev) => ({
        payload: { ...prev.payload, ...updates }
    }))
}));
