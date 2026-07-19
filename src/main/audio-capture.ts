import { logger } from './logger';
import { ipcMain } from 'electron';

export interface AudioData {
  buffer: ArrayBuffer; // Replaced Blob with ArrayBuffer for Node.js compatibility
  timestamp: number;
}

export class AudioCaptureService {
  private isCapturing: boolean = false;
  private audioChunks: ArrayBuffer[] = [];
  private onAudioData: ((chunk: AudioData) => void) | null = null;
  private activityCallback: ((isActive: boolean) => void) | null = null;

  constructor() {
    // Listen for real-time volume activity changes sent from the Renderer (frontend)
    ipcMain.on('audio-activity-change', (event, isActive: boolean) => {
      if (this.activityCallback) {
        this.activityCallback(isActive);
      }
    });

    // Listen for recorded audio chunks sent from the Renderer (frontend)
    ipcMain.on('audio-chunk-received', (event, buffer: ArrayBuffer) => {
      if (this.isCapturing) {
        this.audioChunks.push(buffer);
        if (this.onAudioData) {
          this.onAudioData({
            buffer,
            timestamp: Date.now()
          });
        }
      }
    });
  }

  // Public method for main.ts to register its IPC forwarding hook
  public onActivityChange(callback: (isActive: boolean) => void): void {
    this.activityCallback = callback;
  }

  public async startCapture(): Promise<void> {
    try {
      if (this.isCapturing) {
        logger.warn('Audio capture already in progress');
        return;
      }
      this.isCapturing = true;
      logger.info('Main process ready to receive audio chunks from renderer.');
    } catch (error) {
      logger.error('Failed to start audio capture state:', error);
      throw error;
    }
  }

  public stopCapture(): void {
    this.isCapturing = false;
    
    // Ensure we notify main process it stopped detecting sound
    if (this.activityCallback) {
      this.activityCallback(false);
    }
    
    this.audioChunks = [];
    logger.info('Main process stopped accepting audio chunks.');
  }

  // Stubs for microphone methods to prevent undefined errors in main.ts
  public async startMicrophoneCapture(): Promise<void> {
    logger.info('Microphone capture state activated in Main Process.');
  }

  public stopMicrophoneCapture(): void {
    logger.info('Microphone capture state deactivated in Main Process.');
  }

  public setOnAudioData(callback: (chunk: AudioData) => void): void {
    this.onAudioData = callback;
  }

  public getAudioChunks(): ArrayBuffer[] {
    return this.audioChunks;
  }

  public clearAudioChunks(): void {
    this.audioChunks = [];
  }

  public isActive(): boolean {
    return this.isCapturing;
  }
}
