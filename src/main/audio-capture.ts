import { desktopCapturer, systemPreferences } from 'electron';
import { logger } from './logger';

export class AudioCaptureService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isCapturing: boolean = false;
  private audioChunks: Blob[] = [];
  private onAudioData: ((chunk: AudioData) => void) | null = null;

  constructor() {
    this.setupAudioContext();
  }

  private setupAudioContext(): void {
    try {
      // @ts-ignore - AudioContext may not be available in all Electron versions
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      logger.error('Failed to create AudioContext:', error);
    }
  }

  public async startCapture(): Promise<void> {
    try {
      if (this.isCapturing) {
        logger.warn('Audio capture already in progress');
        return;
      }

      // Get system audio stream
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available for audio capture');
      }

      // Get audio stream from screen capture
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sources[0].id
          }
        },
        video: false
      } as any);

      // Set up MediaRecorder for continuous capture
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          if (this.onAudioData) {
            this.onAudioData({
              blob: event.data,
              timestamp: Date.now()
            });
          }
        }
      };

      this.mediaRecorder.start(100); // Capture every 100ms
      this.isCapturing = true;

      logger.info('System audio capture started');
    } catch (error) {
      logger.error('Failed to start audio capture:', error);
      throw error;
    }
  }

  public stopCapture(): void {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
      }

      this.isCapturing = false;
      this.audioChunks = [];
      
      logger.info('Audio capture stopped');
    } catch (error) {
      logger.error('Failed to stop audio capture:', error);
    }
  }

  public async startMicrophoneCapture(): Promise<void> {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      // Merge with existing system audio stream
      if (this.mediaStream) {
        micStream.getAudioTracks().forEach(track => {
          this.mediaStream?.addTrack(track);
        });
      } else {
        this.mediaStream = micStream;
      }

      logger.info('Microphone capture started');
    } catch (error) {
      logger.error('Failed to start microphone capture:', error);
      throw error;
    }
  }

  public stopMicrophoneCapture(): void {
    try {
      if (this.mediaStream) {
        // Remove microphone tracks only
        const micTracks = this.mediaStream.getAudioTracks().filter(
          track => track.label.includes('Microphone')
        );
        micTracks.forEach(track => track.stop());
      }
    } catch (error) {
      logger.error('Failed to stop microphone capture:', error);
    }
  }

  public setOnAudioData(callback: (chunk: AudioData) => void): void {
    this.onAudioData = callback;
  }

  public getAudioChunks(): Blob[] {
    return this.audioChunks;
  }

  public clearAudioChunks(): void {
    this.audioChunks = [];
  }

  public isActive(): boolean {
    return this.isCapturing;
  }
}

export interface AudioData {
  blob: Blob;
  timestamp: number;
}
