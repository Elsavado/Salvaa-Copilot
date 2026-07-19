import { create } from 'zustand';
import { InterviewSession, QAPair, TranscriptionChunk } from '../../shared/types';

interface InterviewState {
  isInterviewActive: boolean;
  isLoading: boolean; // Added: Tracks Claude generation state
  currentSession: InterviewSession | null;
  transcriptionHistory: TranscriptionChunk[];
  currentQuestion: string;
  currentAnswer: string;
  sessions: InterviewSession[];
  
  setInterviewActive: (active: boolean) => void;
  setLoading: (loading: boolean) => void; // Added: Update loading indicators
  setCurrentSession: (session: InterviewSession | null) => void;
  addTranscriptionChunk: (chunk: TranscriptionChunk) => void;
  setCurrentQuestion: (question: string) => void;
  setCurrentAnswer: (answer: string) => void;
  appendAnswerToken: (token: string) => void; // Added: High-performance token appending
  addQAPair: (qa: QAPair) => void;
  loadSessions: () => Promise<void>;
  saveCurrentSession: () => Promise<void>;
}

export const useInterviewStore = create<InterviewState>((set, get) => ({
  isInterviewActive: false,
  isLoading: false, // Added default state
  currentSession: null,
  transcriptionHistory: [],
  currentQuestion: '',
  currentAnswer: '',
  sessions: [],
  
  setInterviewActive: (active) => set({ isInterviewActive: active }),
  
  setLoading: (loading) => set({ isLoading: loading }), // Added
  
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

  // Added: Smooth token concatenator for real-time overlay streaming
  appendAnswerToken: (token) => set((state) => ({ currentAnswer: state.currentAnswer + token })),
  
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
      // @ts-ignore
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
        // @ts-ignore
        await window.electronAPI.saveSession(session);
      } catch (error) {
        console.error('Failed to save session:', error);
      }
    }
  }
}));
