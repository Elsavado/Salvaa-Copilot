import React, { useState } from 'react';
import { useInterviewStore } from '../stores/interviewStore';
import { useSettingsStore } from '../stores/settingsStore';

const ScreenReaderButton: React.FC = () => {
  const [isReading, setIsReading] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const { setCurrentQuestion } = useInterviewStore();
  const { settings } = useSettingsStore();

  const handleReadScreen = async () => {
    setIsReading(true);
    setExtractedText('');

    try {
      const result = await window.electronAPI.readScreen();
      
      if (result.text) {
        setExtractedText(result.text);
        setCurrentQuestion(result.text);
      }
    } catch (error) {
      console.error('Failed to read screen:', error);
      setExtractedText('Failed to read screen. Please try again.');
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-emerald-400">Screen Reader</h3>
        <span className="text-xs text-gray-400">
          {settings.autoScreenMonitoring ? 'Auto: ON' : 'Auto: OFF'}
        </span>
      </div>

      <button
        onClick={handleReadScreen}
        disabled={isReading}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2"
      >
        {isReading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            <span>Reading Screen...</span>
          </>
        ) : (
          <>
            <span>📖</span>
            <span>Read Screen (Ctrl+Shift+R)</span>
          </>
        )}
      </button>

      {extractedText && (
        <div className="bg-gray-700 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Extracted Text</span>
            <button
              onClick={() => navigator.clipboard.writeText(extractedText)}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              Copy
            </button>
          </div>
          <p className="text-sm text-gray-300 line-clamp-4">{extractedText}</p>
        </div>
      )}

      {/* Auto Screen Monitoring Toggle */}
      <div className="border-t border-gray-700 pt-3">
        <label className="flex items-center justify-between">
          <div>
            <span className="text-sm text-white">Auto Screen Monitoring</span>
            <p className="text-xs text-gray-400">Automatically detect new questions on screen</p>
          </div>
          <button
            onClick={() => {
              window.electronAPI.saveSettings({
                ...settings,
                autoScreenMonitoring: !settings.autoScreenMonitoring
              });
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.autoScreenMonitoring ? 'bg-emerald-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.autoScreenMonitoring ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>
    </div>
  );
};

export default ScreenReaderButton;
