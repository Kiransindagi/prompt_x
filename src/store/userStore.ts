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
    
    login: (user: UserProfile) => void;
    logout: () => void;
    updateProfile: (profile: Partial<UserProfile>) => void;
}

export const useUserStore = create<UserState>()(persist((set) => ({
    user: null,
    isAuthenticated: false,
    
    login: (user) => set({ user, isAuthenticated: true }),
    logout: () => set({ user: null, isAuthenticated: false }),
    updateProfile: (profile) => set((state) => ({ 
        user: state.user ? { ...state.user, ...profile } : null 
    })),
}), { name: 'prompt-x-profile' }));
