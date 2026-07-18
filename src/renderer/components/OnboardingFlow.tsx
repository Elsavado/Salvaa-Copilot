import React, { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import Branding from './Branding';

const OnboardingFlow: React.FC = () => {
  const [step, setStep] = useState(0);
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    anthropic: 'idle' | 'testing' | 'valid' | 'invalid';
    assembly: 'idle' | 'testing' | 'valid' | 'invalid';
  }>({ anthropic: 'idle', assembly: 'idle' });
  const [cvStatus, setCvStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'skipped'>('idle');
  const [preFlightStatus, setPreFlightStatus] = useState<'idle' | 'setup' | 'complete' | 'skipped'>('idle');
  const [error, setError] = useState<string | null>(null);
  const { setOnboardingComplete } = useAppStore();
  const { settings, updateSettings } = useSettingsStore();

  const steps = [
    {
      title: 'Welcome to Salvaaa Copilot',
      description: 'Your AI-powered interview assistant',
      content: (
        <div className="text-center space-y-4">
          <div className="text-6xl">🚀</div>
          <p className="text-gray-300">
            This guided setup will configure everything you need to ace your interviews.
          </p>
          <p className="text-sm text-gray-400">
            A Product of Salvaaa Technical Solutions
          </p>
        </div>
      )
    },
    {
      title: 'API Keys Setup',
      description: 'Configure your AI and transcription services',
      content: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Anthropic API Key (Required)
            </label>
            <input
              type="password"
              placeholder="sk-ant-..."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              onChange={(e) => updateSettings({ anthropicApiKey: e.target.value })}
            />
            {apiKeyStatus.anthropic === 'valid' && (
              <p className="text-green-400 text-sm mt-1">✓ Key validated</p>
            )}
            {apiKeyStatus.anthropic === 'invalid' && (
              <p className="text-red-400 text-sm mt-1">✗ Invalid key</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Assembly AI API Key (Required for STT)
            </label>
            <input
              type="password"
              placeholder="Enter your Assembly AI API key"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              onChange={(e) => updateSettings({ assemblyAiApiKey: e.target.value })}
            />
            {apiKeyStatus.assembly === 'valid' && (
              <p className="text-green-400 text-sm mt-1">✓ Key validated</p>
            )}
            {apiKeyStatus.assembly === 'invalid' && (
              <p className="text-red-400 text-sm mt-1">✗ Invalid key</p>
            )}
          </div>
          
          <button
            onClick={async () => {
              setApiKeyStatus({ anthropic: 'testing', assembly: 'testing' });
              try {
                // Validate Anthropic key
                const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': settings.anthropicApiKey,
                    'anthropic-version': '2023-06-01'
                  },
                  body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'test' }]
                  })
                });
                
                setApiKeyStatus(prev => ({
                  ...prev,
                  anthropic: anthropicResponse.ok ? 'valid' : 'invalid'
                }));

                // Validate AssemblyAI key
                const assemblyResponse = await fetch('https://api.assemblyai.com/v2/realtime/token', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'authorization': settings.assemblyAiApiKey
                  },
                  body: JSON.stringify({ expires_in: 60 })
                });

                setApiKeyStatus(prev => ({
                  ...prev,
                  assembly: assemblyResponse.ok ? 'valid' : 'invalid'
                }));
              } catch (err) {
                setError('Failed to validate API keys. Please check your internet connection.');
              }
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
          >
            Validate Keys
          </button>
        </div>
      )
    },
    {
      title: 'Upload Your CV/Resume',
      description: 'Personalize your answers with your experience',
      content: (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              id="cv-upload"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCvStatus('uploading');
                  try {
                    const text = await file.text();
                    await window.electronAPI.saveCVData({
                      rawText: text,
                      parsedSections: {
                        skills: [],
                        experience: [],
                        education: [],
                        projects: []
                      },
                      fileName: file.name,
                      uploadedAt: new Date().toISOString()
                    });
                    setCvStatus('uploaded');
                  } catch (err) {
                    setError('Failed to upload CV');
                    setCvStatus('idle');
                  }
                }
              }}
            />
            <label htmlFor="cv-upload" className="cursor-pointer">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-gray-300 mb-2">Click to upload your CV</p>
              <p className="text-sm text-gray-500">Supports PDF, DOCX, TXT</p>
            </label>
          </div>
          
          {cvStatus === 'uploaded' && (
            <p className="text-green-400">✓ CV uploaded successfully</p>
          )}
          
          <button
            onClick={() => setCvStatus('skipped')}
            className="text-sm text-gray-400 hover:text-gray-300"
          >
            Skip for now (you can add it later)
          </button>
        </div>
      )
    },
    {
      title: 'Pre-Flight Setup (Optional)',
      description: 'Prepare for your upcoming interview',
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Do you have an upcoming interview you'd like to prepare for?
          </p>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Company name"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
            <input
              type="text"
              placeholder="Role title"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
            <textarea
              placeholder="Paste job description here..."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-32"
            />
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => setPreFlightStatus('complete')}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
            >
              Save & Generate Questions
            </button>
            <button
              onClick={() => setPreFlightStatus('skipped')}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
            >
              Skip
            </button>
          </div>
        </div>
      )
    },
    {
      title: "You're All Set! 🎉",
      description: 'Your copilot is ready to assist you',
      content: (
        <div className="text-center space-y-6">
          <div className="text-6xl">🎯</div>
          <h3 className="text-2xl font-bold text-emerald-400">Setup Complete!</h3>
          <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-left">
            <div className="flex items-center space-x-2">
              <span className="text-green-400">✓</span>
              <span>API Keys configured</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-400">✓</span>
              <span>CV uploaded</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-400">✓</span>
              <span>Pre-flight data ready</span>
            </div>
          </div>
          <p className="text-gray-400">
            Press Ctrl+Shift+S (Cmd+Shift+S on Mac) to toggle the overlay
          </p>
          <button
            onClick={() => {
              updateSettings({ onboardingComplete: true });
              setOnboardingComplete(true);
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg text-lg font-bold"
          >
            Start Using Copilot
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4">
        {/* Progress Bar */}
        <div className="flex justify-between mb-8">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`flex-1 h-2 rounded mx-1 ${
                index <= step ? 'bg-emerald-500' : 'bg-gray-700'
              }`}
            />
          ))}
        </div>
        
        {/* Step Content */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">{steps[step].title}</h2>
            <p className="text-gray-400">{steps[step].description}</p>
          </div>
          
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded p-3">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}
          
          {steps[step].content}
          
          {/* Navigation */}
          <div className="flex justify-between pt-4">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="text-gray-400 hover:text-white"
              >
                Back
              </button>
            )}
            {step < steps.length - 1 && (
              <button
                onClick={() => setStep(step + 1)}
                className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded"
              >
                Continue
              </button>
            )}
          </div>
        </div>
        
        <Branding />
      </div>
    </div>
  );
};

export default OnboardingFlow;
