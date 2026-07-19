import { logger } from './logger';

export class AudioCaptureService {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isCapturing: boolean = false;
  private audioChunks: Blob[] = [];
  private onAudioData: ((chunk: AudioData) => void) | null = null;

  // Real-time volume analyzer properties
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isSoundDetected: boolean = false;
  private checkInterval: any = null;
  
  // NEW: Callback reference to notify main.ts of volume activity changes
  private activityCallback: ((isActive: boolean) => void) | null = null;

  constructor() {
    // Expose this instance to the window context so Overlay.tsx can loop-poll it
    // @ts-ignore
    window.audioCaptureService = this;
  }

  // NEW: Public method for main.ts to register its IPC forwarding hook
  public onActivityChange(callback: (isActive: boolean) => void): void {
    this.activityCallback = callback;
  }

  public async startCapture(): Promise<void> {
    try {
      if (this.isCapturing) {
        logger.warn('Audio capture already in progress');
        return;
      }

      // 1. Fetch the source ID safely from the Main Process via the Electron IPC bridge
      // @ts-ignore
      const sourceId = await window.electronAPI.getDesktopSourceId();
      if (!sourceId) {
        throw new Error('No desktop source ID available for audio capture');
      }

      // 2. Use browser mediaDevices to capture the system desktop stream
      const rawStream = await navigator.mediaDevices.getUserMedia({
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

      // CRITICAL FIX: Extract audio tracks into an independent stream for Web Audio API BEFORE destroying video tracks
      const audioTracks = rawStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks found in desktop capture stream');
      }
      
      const audioOnlyStream = new MediaStream(audioTracks);
      this.mediaStream = rawStream;

      // Clean up the video track from the primary stream so we aren't wasting resources
      const videoTracks = this.mediaStream.getVideoTracks();
      if (videoTracks.length > 0) {
        this.mediaStream.removeTrack(videoTracks[0]);
        videoTracks[0].stop();
      }

      // 3. Set up Web Audio Analyser Node to track active decibel frequencies
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(audioOnlyStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256; 
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Poll audio buffer data every 100ms
      this.checkInterval = setInterval(() => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let totalAmplitude = 0;
        for (let i = 0; i < bufferLength; i++) {
          totalAmplitude += dataArray[i];
        }
        const averageVolume = totalAmplitude / bufferLength;

        // A threshold of 2 filters out minor microphone loop/system background hiss
        const currentDetection = averageVolume > 2;
        
        // NEW: Only trigger the callback if the sound detection state actually changes
        if (currentDetection !== this.isSoundDetected) {
          this.isSoundDetected = currentDetection;
          if (this.activityCallback) {
            this.activityCallback(this.isSoundDetected);
          }
        }
      }, 100);

      // 4. Set up MediaRecorder for continuous capture split chunks
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

      logger.info('System audio capture started successfully with real-time volume detection');
    } catch (error) {
      logger.error('Failed to start audio capture:', error);
      this.stopCapture();
      throw error;
    }
  }

  // Public getter method read directly by your Overlay.tsx UI loop
  public isAudioPlaying(): boolean {
    return this.isCapturing && this.isSoundDetected;
  }

  public stopCapture(): void {
    try {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }

      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
        this.analyser = null;
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      // NEW: Ensure we notify main process it stopped talking
      if (this.isSoundDetected && this.activityCallback) {
        this.activityCallback(false);
      }

      this.isCapturing = false;
      this.isSoundDetected = false;
      this.audioChunks = [];
      
      logger.info('Audio capture stopped and audio context cleaned up');
    } catch (error) {
      logger.error('Failed to stop audio capture smoothly:', error);
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
