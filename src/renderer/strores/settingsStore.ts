import { create } from 'zustand';
import { AppSettings } from '../../shared/types';

interface SettingsState {
  settings: AppSettings;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  anthropicApiKey: '',
  assemblyAiApiKey: '',
  aiModel: 'claude-3-5-sonnet-20241022',
  sttLanguage: 'en',
  overlayOpacity: 0.85,
  overlayWidth: 400,
  overlayHeight: 600,
  audioSource: 'system',
  autoScreenMonitoring: false,
  autoScrollSpeed: 1,
  theme: 'dark',
  fontSize: 14,
  clickThroughMode: false,
  interviewAutoDetect: true,
  onboardingComplete: false
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  
  loadSettings: async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      set({ settings: settings || defaultSettings });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ settings: defaultSettings });
    }
  },
  
  saveSettings: async (settings: AppSettings) => {
    try {
      await window.electronAPI.saveSettings(settings);
      set({ settings });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  },
  
  updateSettings: (partial: Partial<AppSettings>) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    set({ settings: updated });
    // Auto-save
    window.electronAPI.saveSettings(updated).catch(console.error);
  }
}));
