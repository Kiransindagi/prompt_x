import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HistoryItem {
    id: string;
    mode: string;
    createdAt: string;
    original: string;
    ai: string;
    model: string;
}

interface HistoryState {
    items: HistoryItem[];
    add: (item: Omit<HistoryItem, 'id' | 'createdAt'>) => void;
    pruneOlderThan: (days: number) => void;
    clear: () => void;
}

export const useHistoryStore = create<HistoryState>()(persist((set) => ({
    items: [],
    add: (item) => set((state) => ({
        items: [{ ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...state.items].slice(0, 200)
    })),
    pruneOlderThan: (days) => set((state) => {
        const cutoff = Date.now() - days * 86_400_000;
        return { items: state.items.filter((item) => Date.parse(item.createdAt) >= cutoff) };
    }),
    clear: () => set({ items: [] }),
}), { name: 'prompt-x-history' }));
