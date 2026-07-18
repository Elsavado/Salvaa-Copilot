import React, { useState, useEffect } from 'react';
import { useInterviewStore } from '../stores/interviewStore';

const InterviewDetector: React.FC = () => {
  const { isInterviewActive, setInterviewActive } = useInterviewStore();
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);

  useEffect(() => {
    // Listen for interview status changes from main process
    const cleanupStart = window.electronAPI.onInterviewStarted(() => {
      setInterviewActive(true);
    });

    const cleanupEnd = window.electronAPI.onInterviewEnded(() => {
      setInterviewActive(false);
      setDetectedPlatform(null);
    });

    // Check initial status
    window.electronAPI.getInterviewStatus().then(status => {
      setInterviewActive(status.active);
    });

    return () => {
      cleanupStart();
      cleanupEnd();
    };
  }, []);

  const platforms = [
    { name: 'Zoom', icon: '🎥' },
    { name: 'Google Meet', icon: '💻' },
    { name: 'Microsoft Teams', icon: '👥' },
    { name: 'Webex', icon: '📞' },
    { name: 'Skype', icon: '📱' },
    { name: 'Discord', icon: '🎮' },
    { name: 'Micro1', icon: '🤖' },
    { name: 'HireVue', icon: '📹' },
    { name: 'CoderPad', icon: '💻' },
    { name: 'Other', icon: '📋' }
  ];

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${
        isInterviewActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
      }`} />
      <span className="text-sm text-gray-300">
        {isInterviewActive ? (
          <span className="text-green-400">
            Interview Active
            {detectedPlatform && ` - ${detectedPlatform}`}
          </span>
        ) : (
          'No Interview Detected'
        )}
      </span>
    </div>
  );
};

export default InterviewDetector;
