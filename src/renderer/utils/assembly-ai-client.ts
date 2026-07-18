import { AssemblyAI } from 'assemblyai';

interface TranscriptionConfig {
  apiKey: string;
  language?: string;
  sampleRate?: number;
}

export class AssemblyAIClient {
  private client: AssemblyAI;
  private realtimeTranscriber: any = null;
  private onTranscript: ((text: string, isFinal: boolean) => void) | null = null;

  constructor(config: TranscriptionConfig) {
    this.client = new AssemblyAI({
      apiKey: config.apiKey
    });
  }

  async startRealtimeTranscription(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      this.onTranscript = onTranscript;

      this.realtimeTranscriber = await this.client.realtime.transcribe({
        sampleRate: 16000,
        wordBoost: ['interview', 'technical', 'coding', 'algorithm']
      });

      this.realtimeTranscriber.on('transcript', (transcript: any) => {
        if (this.onTranscript) {
          this.onTranscript(
            transcript.text,
            transcript.message_type === 'FinalTranscript'
          );
        }
      });

      this.realtimeTranscriber.on('error', (error: Error) => {
        console.error('Transcription error:', error);
        if (onError) {
          onError(error);
        }
      });

      console.log('Real-time transcription started');
    } catch (error) {
      console.error('Failed to start real-time transcription:', error);
      throw error;
    }
  }

  stopRealtimeTranscription(): void {
    if (this.realtimeTranscriber) {
      this.realtimeTranscriber.close();
      this.realtimeTranscriber = null;
    }
    this.onTranscript = null;
    console.log('Real-time transcription stopped');
  }

  async transcribeAudio(audioUrl: string): Promise<string> {
    try {
      const transcript = await this.client.transcripts.transcribe({
        audio: audioUrl
      });

      return transcript.text || '';
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      throw error;
    }
  }

  async transcribeAudioData(audioData: Blob): Promise<string> {
    try {
      const transcript = await this.client.transcripts.transcribe({
        audio: audioData
      });

      return transcript.text || '';
    } catch (error) {
      console.error('Failed to transcribe audio data:', error);
      throw error;
    }
  }

  sendAudioData(audioData: ArrayBuffer): void {
    if (this.realtimeTranscriber) {
      this.realtimeTranscriber.sendAudio(audioData);
    }
  }

  isTranscribing(): boolean {
    return this.realtimeTranscriber !== null;
  }
}
