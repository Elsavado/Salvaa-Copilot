import React, { useState, useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { useSettingsStore } from './stores/settingsStore';
import { useInterviewStore } from './stores/interviewStore';
import OnboardingFlow from './components/OnboardingFlow';
import Overlay from './components/Overlay';
import SettingsPanel from './components/SettingsPanel';
import CVUpload from './components/CVUpload';
import PreFlightSetup from './components/PreFlightSetup';
import AnswerDisplay from './components/AnswerDisplay';
import AudioSourcePicker from './components/AudioSourcePicker';
import ScreenReaderButton from './components/ScreenReaderButton';
import InterviewDetector from './components/InterviewDetector';
import Branding from './components/Branding';

const App: React.FC = () => {
  const { onboardingComplete, setOnboardingComplete } = useAppStore();
  const { settings, loadSettings } = useSettingsStore();
  const { isInterviewActive } = useInterviewStore();
  const [currentView, setCurrentView] = useState<'main' | 'settings' | 'cv' | 'preflight'>('main');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await loadSettings();
        
        // Check if onboarding is needed
        if (!settings.onboardingComplete) {
          setOnboardingComplete(false);
        }
      } catch (err) {
        setError('Failed to initialize application. Please check your configuration.');
        console.error('Initialization error:', err);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    // Listen for navigation events from main process
    const cleanup = window.electronAPI.onNavigate((route: any) => {
      setCurrentView(route as 'main' | 'settings' | 'cv' | 'preflight');
    });

    return cleanup;
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-red-400 text-xl font-bold mb-4">Error</h2>
          <p className="text-red-200">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!onboardingComplete) {
    return <OnboardingFlow />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-bold text-emerald-400">Salvaaa Copilot</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentView('main')}
              className={`px-3 py-1 rounded text-sm ${
                currentView === 'main' ? 'bg-emerald-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Main
            </button>
            <button
              onClick={() => setCurrentView('settings')}
              className={`px-3 py-1 rounded text-sm ${
                currentView === 'settings' ? 'bg-emerald-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setCurrentView('cv')}
              className={`px-3 py-1 rounded text-sm ${
                currentView === 'cv' ? 'bg-emerald-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              CV
            </button>
            <button
              onClick={() => setCurrentView('preflight')}
              className={`px-3 py-1 rounded text-sm ${
                currentView === 'preflight' ? 'bg-emerald-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Pre-Flight
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <InterviewDetector />
          <button
            onClick={() => window.electronAPI.toggleOverlay()}
            className={`px-3 py-1 rounded text-sm ${
              isInterviewActive ? 'bg-green-600' : 'bg-gray-600'
            }`}
          >
            {isInterviewActive ? 'Overlay Active' : 'Overlay Off'}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="p-6">
        {currentView === 'main' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AnswerDisplay />
              <div className="space-y-4">
                <AudioSourcePicker />
                <ScreenReaderButton />
              </div>
            </div>
          </div>
        )}

        {currentView === 'settings' && <SettingsPanel />}
        {currentView === 'cv' && <CVUpload />}
        {currentView === 'preflight' && <PreFlightSetup />}
      </div>

      {/* Branding Footer */}
      <Branding />
    </div>
  );
};

export default App;
