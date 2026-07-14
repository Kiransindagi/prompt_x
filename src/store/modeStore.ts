import { create } from 'zustand';

interface ModeState {
    activeMode: string;
    setActiveMode: (mode: string) => void;
}

export const useModeStore = create<ModeState>((set) => ({
    activeMode: 'creative', // Default to creative
    setActiveMode: (activeMode) => set({ activeMode }),
}));
