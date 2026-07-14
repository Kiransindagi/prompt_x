import { create } from 'zustand';

interface UserProfile {
    name: string;
    email: string;
    avatar?: string;
}

interface UserState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    plan: 'FREE' | 'PRO';
    
    login: (user: UserProfile) => void;
    logout: () => void;
    updateProfile: (profile: Partial<UserProfile>) => void;
    setPlan: (plan: 'FREE' | 'PRO') => void;
}

export const useUserStore = create<UserState>((set) => ({
    user: {
        name: 'Kiran',
        email: 'kiran@email.com',
    },
    isAuthenticated: true, // Defaulting to true for demo purposes, as seen in App.tsx
    plan: 'FREE',
    
    login: (user) => set({ user, isAuthenticated: true }),
    logout: () => set({ user: null, isAuthenticated: false }),
    updateProfile: (profile) => set((state) => ({ 
        user: state.user ? { ...state.user, ...profile } : null 
    })),
    setPlan: (plan) => set({ plan }),
}));
