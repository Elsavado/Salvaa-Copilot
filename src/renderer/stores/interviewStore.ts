import { create } from 'zustand';
import { InterviewSession, QAPair, TranscriptionChunk } from '../../shared/types';

interface InterviewState {
  isInterviewActive: boolean;
  currentSession: InterviewSession | null;
  transcriptionHistory: TranscriptionChunk[];
  currentQuestion: string;
  currentAnswer: string;
  sessions: InterviewSession[];
  
  setInterviewActive: (active: boolean) => void;
  setCurrentSession: (session: InterviewSession | null) => void;
  addTranscriptionChunk: (chunk: TranscriptionChunk) => void;
  setCurrentQuestion: (question: string) => void;
  setCurrentAnswer: (answer: string) => void;
  addQAPair: (qa: QAPair) => void;
  loadSessions: () => Promise<void>;
  saveCurrentSession: () => Promise<void>;
}

export const useInterviewStore = create<InterviewState>((set, get) => ({
  isInterviewActive: false,
  currentSession: null,
  transcriptionHistory: [],
  currentQuestion: '',
  currentAnswer: '',
  sessions: [],
  
  setInterviewActive: (active) => set({ isInterviewActive: active }),
  
  setCurrentSession: (session) => set({ currentSession: session }),
  
  addTranscriptionChunk: (chunk) => {
    const history = get().transcriptionHistory;
    set({ transcriptionHistory: [...history, chunk] });
    
    // If it's a question from the interviewer, update current question
    if (chunk.speaker === 'interviewer' && chunk.isFinal) {
      set({ currentQuestion: chunk.text });
    }
  },
  
  setCurrentQuestion: (question) => set({ currentQuestion: question }),
  
  setCurrentAnswer: (answer) => set({ currentAnswer: answer }),
  
  addQAPair: (qa) => {
    const session = get().currentSession;
    if (session) {
      const updatedSession = {
        ...session,
        questions: [...session.questions, qa]
      };
      set({ currentSession: updatedSession });
    }
  },
  
  loadSessions: async () => {
    try {
      const sessions = await window.electronAPI.getAllSessions();
      set({ sessions });
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  },
  
  saveCurrentSession: async () => {
    const session = get().currentSession;
    if (session) {
      try {
        await window.electronAPI.saveSession(session);
      } catch (error) {
        console.error('Failed to save session:', error);
      }
    }
  }
}));
