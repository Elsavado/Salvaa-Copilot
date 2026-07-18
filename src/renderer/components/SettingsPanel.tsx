import React, { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import Branding from './Branding';

const SettingsPanel: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.electronAPI.saveSettings(settings);
      setMessage('Settings saved successfully');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Settings</h2>

      {/* API Keys Section */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-emerald-400">API Keys</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Anthropic API Key
          </label>
          <input
            type="password"
            value={settings.anthropicApiKey}
            onChange={(e) => updateSettings({ anthropicApiKey: e.target.value })}
            placeholder="sk-ant-..."
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Assembly AI API Key
          </label>
          <input
            type="password"
            value={settings.assemblyAiApiKey}
            onChange={(e) => updateSettings({ assemblyAiApiKey: e.target.value })}
            placeholder="Enter your Assembly AI API key"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </div>
      </section>

      {/* AI Model Section */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-emerald-400">AI Model</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Model Selection
          </label>
          <select
            value={settings.aiModel}
            onChange={(e) => updateSettings({ aiModel: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          >
            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
            <option value="claude-3-opus-20240229">Claude 3 Opus</option>
            <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
          </select>
        </div>
      </section>

      {/* Audio Section */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-emerald-400">Audio Settings</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Audio Source
          </label>
          <select
            value={settings.audioSource}
            onChange={(e) => updateSettings({ 
              audioSource: e.target.value as 'system' | 'microphone' | 'both' 
            })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          >
            <option value="system">System Audio (Default)</option>
            <option value="microphone">Microphone</option>
            <option value="both">Both (System + Mic)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            STT Language
          </label>
          <select
            value={settings.sttLanguage}
            onChange={(e) => updateSettings({ sttLanguage: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
          </select>
        </div>
      </section>

      {/* Display Section */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-emerald-400">Display Settings</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Overlay Opacity
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                value={settings.overlayOpacity}
                onChange={(e) => updateSettings({ 
                  overlayOpacity: parseFloat(e.target.value) 
                })}
                className="flex-1"
              />
              <span className="text-sm text-gray-400">
                {Math.round(settings.overlayOpacity * 100)}%
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Font Size
            </label>
            <select
              value={settings.fontSize}
              onChange={(e) => updateSettings({ 
                fontSize: parseInt(e.target.value) 
              })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="12">Small (12px)</option>
              <option value="14">Medium (14px)</option>
              <option value="16">Large (16px)</option>
              <option value="18">Extra Large (18px)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.clickThroughMode}
              onChange={(e) => updateSettings({ 
                clickThroughMode: e.target.checked 
              })}
              className="form-checkbox"
            />
            <span className="text-sm text-gray-300">Click-Through Mode</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.autoScreenMonitoring}
              onChange={(e) => updateSettings({ 
                autoScreenMonitoring: e.target.checked 
              })}
              className="form-checkbox"
            />
            <span className="text-sm text-gray-300">Auto Screen Monitoring</span>
          </label>
        </div>
      </section>

      {/* Interview Detection Section */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-emerald-400">Interview Detection</h3>
        
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={settings.interviewAutoDetect}
            onChange={(e) => updateSettings({ 
              interviewAutoDetect: e.target.checked 
            })}
            className="form-checkbox"
          />
          <span className="text-sm text-gray-300">
            Auto-detect interviews (Zoom, Meet, Teams, etc.)
          </span>
        </label>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => updateSettings({ onboardingComplete: false })}
          className="text-sm text-gray-400 hover:text-white"
        >
          Re-run Setup
        </button>
        
        <div className="flex items-center space-x-4">
          {message && (
            <span className="text-sm text-emerald-400">{message}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white px-6 py-2 rounded"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <Branding />
    </div>
  );
};

export default SettingsPanel;
