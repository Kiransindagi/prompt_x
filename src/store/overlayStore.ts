import { create } from 'zustand';
import { OverlayState, OverlayPayload } from '../ui/overlay/OverlayState';

interface OverlayStore {
    isVisible: boolean;
    state: OverlayState;
    anchorPosition: { x: number; y: number };
    payload: OverlayPayload;
    requestId: number;

    // Actions
    showOverlay: (position: { x: number; y: number }, originalText: string, action?: OverlayPayload['action']) => void;
    setThinking: () => void;
    setExpanded: (resultText: string, analysis?: any, requestId?: number) => void;
    setIdle: () => void;
    hideOverlay: () => void;
    updatePayload: (updates: Partial<OverlayPayload>) => void;
}
 
export const useOverlayStore = create<OverlayStore>((set) => ({
    isVisible: false,
    state: 'hidden',
    anchorPosition: { x: 0, y: 0 },
    payload: { originalText: '' },
    requestId: 0,
 
    showOverlay: (position, originalText, action = 'rewrite') => set((state) => ({
        isVisible: true,
        state: 'idle',
        anchorPosition: position,
        payload: { originalText, action },
        requestId: state.requestId + 1
    })),
 
    setThinking: () => set((state) => ({ state: 'thinking', requestId: state.requestId + 1 })),
 
    setExpanded: (resultText, analysis, requestId) => set((prev) => {
        if (requestId !== undefined && requestId !== prev.requestId) return prev;
        return { state: 'expanded', payload: { ...prev.payload, resultText, analysis } };
    }),

    setIdle: () => set({ state: 'idle' }),

    hideOverlay: () => set((state) => ({
        isVisible: false,
        state: 'hidden',
        payload: { originalText: '' },
        requestId: state.requestId + 1
    })),

    updatePayload: (updates) => set((prev) => ({
        payload: { ...prev.payload, ...updates }
    }))
}));
