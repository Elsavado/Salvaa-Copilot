export interface AppSettings {
  anthropicApiKey: string;
  assemblyAiApiKey: string;
  aiModel: string;
  sttLanguage: string;
  overlayOpacity: number;
  overlayWidth: number;
  overlayHeight: number;
  audioSource: 'system' | 'microphone' | 'both';
  autoScreenMonitoring: boolean;
  autoScrollSpeed: number;
  theme: 'light' | 'dark';
  fontSize: number;
  clickThroughMode: boolean;
  interviewAutoDetect: boolean;
  onboardingComplete: boolean;
}

export interface CVData {
  rawText: string;
  parsedSections: {
    skills: string[];
    experience: string[];
    education: string[];
    projects: string[];
  };
  fileName: string;
  uploadedAt: string;
}

export interface PreFlightData {
  jobDescription: string;
  companyName: string;
  roleTitle: string;
  expectedQuestions: string[];
  practiceNotes: string;
  createdAt: string;
}

export interface InterviewSession {
  id: string;
  platform: string;
  startedAt: string;
  endedAt?: string;
  questions: QAPair[];
  status: 'active' | 'paused' | 'ended';
}

export interface QAPair {
  question: string;
  answer: string;
  timestamp: string;
  source: 'audio' | 'screen' | 'manual';
}

export interface TranscriptionChunk {
  text: string;
  isFinal: boolean;
  timestamp: number;
  speaker?: 'interviewer' | 'candidate';
}

export interface ClaudeResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}
