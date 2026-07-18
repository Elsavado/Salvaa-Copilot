import { create } from 'zustand';

interface AppState {
  onboardingComplete: boolean;
  isLoading: boolean;
  error: string | null;
  setOnboardingComplete: (complete: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  onboardingComplete: false,
  isLoading: false,
  error: null,
  setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error })
}));
