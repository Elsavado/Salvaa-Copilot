import React, { useState, useEffect } from 'react';
import { useInterviewStore } from '../stores/interviewStore';
import { useSettingsStore } from '../stores/settingsStore';
import AnswerDisplay from './AnswerDisplay';
import ScreenReaderButton from './ScreenReaderButton';
import Branding from './Branding';

const Overlay: React.FC = () => {
  const { isInterviewActive, currentQuestion, currentAnswer } = useInterviewStore();
  const { settings } = useSettingsStore();
  const [isVisible, setIsVisible] = useState(true);
  const [opacity, setOpacity] = useState(settings.overlayOpacity || 1);

  useEffect(() => {
    // Listen for overlay toggle from main process
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        setIsVisible(!isVisible);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="w-full h-full bg-gray-900/90 rounded-lg shadow-2xl border border-gray-700 overflow-hidden flex flex-col"
      style={{ opacity }}
    >
      {/* Header */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isInterviewActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-sm font-medium text-white">
            {isInterviewActive ? 'Interview Active' : 'Standby Mode'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-white text-sm"
          >
            Hide
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* Current Question / Audio Status Box */}
        {currentQuestion ? (
          <div className="bg-gray-800 rounded p-3 border border-emerald-500/30">
            <p className="text-xs text-emerald-400 mb-1 font-medium tracking-wide">Interviewer asked:</p>
            <p className="text-sm text-white">{currentQuestion}</p>
          </div>
        ) : (
          <div className="bg-gray-800/40 rounded p-4 border border-dashed border-gray-700 flex flex-col items-center justify-center text-center space-y-3">
            {isInterviewActive ? (
              <>
                {/* Micro Waveform Animation */}
                <div className="flex items-end justify-center space-x-1 h-6 w-12 mb-1">
                  <div className="w-1 bg-emerald-400 rounded-full animate-wave-bar" style={{ height: '100%', animationDelay: '0.1s' }}></div>
                  <div className="w-1 bg-emerald-400 rounded-full animate-wave-bar" style={{ height: '100%', animationDelay: '0.3s' }}></div>
                  <div className="w-1 bg-emerald-400 rounded-full animate-wave-bar" style={{ height: '100%', animationDelay: '0.6s' }}></div>
                  <div className="w-1 bg-emerald-400 rounded-full animate-wave-bar" style={{ height: '100%', animationDelay: '0.2s' }}></div>
                  <div className="w-1 bg-emerald-400 rounded-full animate-wave-bar" style={{ height: '100%', animationDelay: '0.4s' }}></div>
                </div>
                <p className="text-xs font-semibold text-emerald-400 tracking-wide uppercase animate-pulse">
                  Audio source detected
                </p>
                <p className="text-xs text-gray-400 max-w-xs">
                  Awaiting interview questions and Claude answers...
                </p>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse mb-1" />
                <p className="text-xs text-gray-400 font-medium">
                  Waiting for live audio...
                </p>
              </>
            )}
          </div>
        )}

        {/* Answer Display */}
        <AnswerDisplay />

        {/* Screen Reader Button */}
        <ScreenReaderButton />
      </div>

      {/* Footer */}
      <div className="bg-gray-800 px-4 py-2 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-gray-400">Opacity</span>
          </div>
          <Branding />
        </div>
      </div>

      {/* Tailwind & CSS Animation Styles Injection */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: scaleY(0.2); }
          50% { transform: scaleY(1.0); }
        }
        .animate-wave-bar {
          animation: bounce 1.0s ease-in-out infinite;
          transform-origin: bottom;
        }
      `}</style>
    </div>
  );
};

export default Overlay;
