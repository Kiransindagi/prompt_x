import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export const useUserStore = create<UserState>()(persist((set) => ({
    user: null,
    isAuthenticated: false,
    plan: 'FREE',
    
    login: (user) => set({ user, isAuthenticated: true }),
    logout: () => set({ user: null, isAuthenticated: false }),
    updateProfile: (profile) => set((state) => ({ 
        user: state.user ? { ...state.user, ...profile } : null 
    })),
    setPlan: (plan) => set({ plan }),
}), { name: 'prompt-x-profile' }));
