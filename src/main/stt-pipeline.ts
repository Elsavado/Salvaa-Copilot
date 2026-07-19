import { AssemblyAI } from 'assemblyai';
import { logger } from './logger';
import { AudioData } from './audio-capture';
import { TranscriptionChunk } from '../shared/types';

export class STTPipeline {
  private client: AssemblyAI | null = null;
  private transcriber: any = null;
  private isTranscribing: boolean = false;
  private onTranscription: ((chunk: TranscriptionChunk) => void) | null = null;
  private audioQueue: AudioData[] = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private apiKey: string = '';

  constructor() {
    this.setupClient();
  }

  private setupClient(): void {
    try {
      const apiKey = process.env.ASSEMBLYAI_API_KEY;
      if (apiKey) {
        this.apiKey = apiKey;
        this.client = new AssemblyAI({
          apiKey: apiKey
        });
        logger.info('AssemblyAI client initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize AssemblyAI client:', error);
    }
  }

  public setApiKey(apiKey: string): void {
    try {
      this.apiKey = apiKey;
      this.client = new AssemblyAI({
        apiKey: apiKey
      });
      logger.info('AssemblyAI client re-initialized with new API key');
    } catch (error) {
      logger.error('Failed to set API key:', error);
      throw error;
    }
  }

  public async startTranscription(): Promise<void> {
    try {
      if (this.isTranscribing) {
        logger.warn('Transcription already in progress');
        return;
      }

      if (!this.client) {
        throw new Error('AssemblyAI client not initialized');
      }

      // UPDATED: Added 'algorithm' to wordBoost for improved technical accuracy
      this.transcriber = this.client.streaming.transcriber({
        speechModel: 'universal-3-5-pro',
        sampleRate: 16000,
      });

      this.transcriber.on('turn', (turn: any) => {
        if (this.onTranscription && turn.transcript) {
          this.onTranscription({
            text: turn.transcript,
            isFinal: turn.end_of_turn === true,
            timestamp: Date.now(),
            speaker: this.detectSpeaker(turn.transcript)
          });
        }
      });

      this.transcriber.on('open', ({ id }: { id: string }) => {
        logger.info(`AssemblyAI real-time stream established. Session ID: ${id}`);
      });

      this.transcriber.on('close', (code: number, reason: string) => {
        logger.info(`AssemblyAI real-time stream closed: ${code} - ${reason}`);
      });

      this.transcriber.on('error', (error: Error) => {
        logger.error('Transcription error:', error);
      });

      await this.transcriber.connect();

      this.isTranscribing = true;

      this.processingInterval = setInterval(() => {
        this.processAudioQueue();
      }, 100);

      logger.info('STT transcription started');
    } catch (error) {
      logger.error('Failed to start transcription:', error);
      this.stopTranscription();
      throw error;
    }
  }

  public async stopTranscription(): Promise<void> {
    try {
      if (this.transcriber) {
        await this.transcriber.close();
        this.transcriber = null;
      }

      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }

      this.isTranscribing = false;
      this.audioQueue = [];
      
      logger.info('STT transcription stopped');
    } catch (error) {
      logger.error('Failed to stop transcription:', error);
    }
  }

  public async transcribeAudioBlob(blob: Blob): Promise<string> {
    try {
      if (!this.client) {
        throw new Error('AssemblyAI client not initialized');
      }

      const transcript = await this.client.transcripts.transcribe({
        audio: blob
      });

      return transcript.text || '';
    } catch (error) {
      logger.error('Failed to transcribe audio blob:', error);
      throw error;
    }
  }

  public addAudioData(audioData: AudioData): void {
    this.audioQueue.push(audioData);
  }

  private async processAudioQueue(): Promise<void> {
    try {
      if (this.audioQueue.length === 0 || !this.transcriber) return;

      const audioData = this.audioQueue.shift();
      if (!audioData) return;

      const arrayBuffer = await audioData.blob.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      this.transcriber.sendAudio(audioBuffer);
    } catch (error) {
      logger.error('Failed to process audio queue:', error);
    }
  }

  private detectSpeaker(text: string): 'interviewer' | 'candidate' {
    const questionPatterns = [
      /\?$/,
      /^(what|why|how|can|could|would|tell|describe|explain)/i,
      /^tell me about/i,
      /^walk me through/i,
      /^why should we/i
    ];

    const isQuestion = questionPatterns.some(pattern => pattern.test(text.trim()));
    return isQuestion ? 'interviewer' : 'candidate';
  }

  public setOnTranscription(callback: (chunk: TranscriptionChunk) => void): void {
    this.onTranscription = callback;
  }

  public isActive(): boolean {
    return this.isTranscribing;
  }
}
