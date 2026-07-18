import React, { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

const AudioSourcePicker: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [systemPermission, setSystemPermission] = useState<boolean | null>(null);

  const handleAudioSourceChange = async (source: 'system' | 'microphone' | 'both') => {
    updateSettings({ audioSource: source });

    if (source === 'microphone' || source === 'both') {
      await requestMicrophonePermission();
    }

    if (source === 'system' || source === 'both') {
      await requestSystemAudioPermission();
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      const result = await window.electronAPI.requestPermission('microphone');
      setMicPermission(result.granted);
      
      if (!result.granted) {
        alert('Microphone access is required for this audio source. Please grant permission in system settings.');
      }
    } catch (error) {
      console.error('Failed to request microphone permission:', error);
      setMicPermission(false);
    }
  };

  const requestSystemAudioPermission = async () => {
    try {
      const result = await window.electronAPI.requestPermission('screenCapture');
      setSystemPermission(result.granted);
      
      if (!result.granted) {
        alert('Screen recording permission is required for system audio capture. Please grant permission in system settings.');
      }
    } catch (error) {
      console.error('Failed to request system audio permission:', error);
      setSystemPermission(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-emerald-400">Audio Source</h3>
      
      <div className="space-y-2">
        <label className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
          <input
            type="radio"
            name="audioSource"
            value="system"
            checked={settings.audioSource === 'system'}
            onChange={() => handleAudioSourceChange('system')}
            className="form-radio text-emerald-500"
          />
          <div>
            <span className="text-sm text-white">System Audio (Default)</span>
            <p className="text-xs text-gray-400">Captures interviewer's voice from meetings</p>
          </div>
        </label>

        <label className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
          <input
            type="radio"
            name="audioSource"
            value="microphone"
            checked={settings.audioSource === 'microphone'}
            onChange={() => handleAudioSourceChange('microphone')}
            className="form-radio text-emerald-500"
          />
          <div>
            <span className="text-sm text-white">Microphone</span>
            <p className="text-xs text-gray-400">Captures your voice only</p>
          </div>
        </label>

        <label className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
          <input
            type="radio"
            name="audioSource"
            value="both"
            checked={settings.audioSource === 'both'}
            onChange={() => handleAudioSourceChange('both')}
            className="form-radio text-emerald-500"
          />
          <div>
            <span className="text-sm text-white">Both (System + Mic)</span>
            <p className="text-xs text-gray-400">Captures all audio</p>
          </div>
        </label>
      </div>

      {/* Permission Status */}
      <div className="text-xs space-y-1">
        {micPermission !== null && (
          <p className={micPermission ? 'text-green-400' : 'text-red-400'}>
            Microphone: {micPermission ? '✓ Granted' : '✗ Not granted'}
          </p>
        )}
        {systemPermission !== null && (
          <p className={systemPermission ? 'text-green-400' : 'text-red-400'}>
            System Audio: {systemPermission ? '✓ Granted' : '✗ Not granted'}
          </p>
        )}
      </div>

      {/* Enable Microphone Toggle */}
      <div className="border-t border-gray-700 pt-3">
        <label className="flex items-center justify-between">
          <div>
            <span className="text-sm text-white">Enable Microphone</span>
            <p className="text-xs text-gray-400">Allow microphone access for your voice</p>
          </div>
          <button
            onClick={() => {
              if (settings.audioSource === 'microphone' || settings.audioSource === 'both') {
                handleAudioSourceChange('system');
              } else {
                handleAudioSourceChange('both');
              }
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.audioSource === 'microphone' || settings.audioSource === 'both'
                ? 'bg-emerald-600'
                : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.audioSource === 'microphone' || settings.audioSource === 'both'
                  ? 'translate-x-6'
                  : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>
    </div>
  );
};

export default AudioSourcePicker;
