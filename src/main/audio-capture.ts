import { logger } from './logger';

export class AudioCaptureService {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isCapturing: boolean = false;
  private audioChunks: Blob[] = [];
  private onAudioData: ((chunk: AudioData) => void) | null = null;

  public async startCapture(): Promise<void> {
    try {
      if (this.isCapturing) {
        logger.warn('Audio capture already in progress');
        return;
      }

      // 1. Fetch the source ID safely from the Main Process via the Electron IPC bridge
      // @ts-ignore - window.electronAPI might not be typed globally
      const sourceId = await window.electronAPI.getDesktopSourceId();
      if (!sourceId) {
        throw new Error('No desktop source ID available for audio capture');
      }

      // 2. Use browser mediaDevices to capture the system desktop stream
      // We must pass a video parameter constraint, otherwise Chromium blocks audio-only stream allocations.
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          }
        },
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          },
          optional: [
            { width: 4 },
            { height: 4 },
            { frameRate: 1 }
          ]
        }
      } as any);

      // CRITICAL: Immediately strip out the video track channel so we only process system audio
      const videoTracks = this.mediaStream.getVideoTracks();
      if (videoTracks.length > 0) {
        this.mediaStream.removeTrack(videoTracks[0]);
        videoTracks[0].stop();
      }

      // 3. Set up MediaRecorder for continuous capture
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

      this.mediaRecorder.start(100); // Capture and stream chunks every 100ms
      this.isCapturing = true;

      logger.info('System audio capture started successfully');
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
