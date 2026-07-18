import { desktopCapturer, screen } from 'electron';
import { createWorker } from 'tesseract.js';
import { logger } from './logger';

export class ScreenReaderService {
  private worker: Tesseract.Worker | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker(): Promise<void> {
    try {
      this.worker = await createWorker('eng');
      this.isInitialized = true;
      logger.info('OCR worker initialized');
    } catch (error) {
      logger.error('Failed to initialize OCR worker:', error);
    }
  }

  public async captureAndRead(): Promise<string> {
    try {
      // Capture the screen
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: screen.getPrimaryDisplay().size.width,
          height: screen.getPrimaryDisplay().size.height
        }
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      // Get the primary display's screenshot
      const primarySource = sources[0];
      const screenshot = primarySource.thumbnail;

      // Convert to PNG buffer
      const pngBuffer = screenshot.toPNG();

      // Perform OCR
      if (!this.worker || !this.isInitialized) {
        await this.initializeWorker();
      }

      if (!this.worker) {
        throw new Error('OCR worker not available');
      }

      const { data } = await this.worker.recognize(pngBuffer);
      
      logger.info('Screen reading completed');
      return data.text;
    } catch (error) {
      logger.error('Failed to read screen:', error);
      throw error;
    }
  }

  public async captureAndReadRegion(region: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<string> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: screen.getPrimaryDisplay().size.width,
          height: screen.getPrimaryDisplay().size.height
        }
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      const primarySource = sources[0];
      const screenshot = primarySource.thumbnail;

      // Crop to region
      const canvas = document.createElement('canvas');
      canvas.width = region.width;
      canvas.height = region.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to create canvas context');
      }

      ctx.drawImage(
        screenshot as unknown as HTMLImageElement,
        region.x, region.y,
        region.width, region.height,
        0, 0,
        region.width, region.height
      );

      const pngBuffer = canvas.toDataURL('image/png');

      if (!this.worker || !this.isInitialized) {
        await this.initializeWorker();
      }

      if (!this.worker) {
        throw new Error('OCR worker not available');
      }

      const { data } = await this.worker.recognize(pngBuffer);
      
      logger.info('Screen region reading completed');
      return data.text;
    } catch (error) {
      logger.error('Failed to read screen region:', error);
      throw error;
    }
  }

  public async captureAndReadWithClaude(): Promise<string> {
    try {
      // Capture screen
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: screen.getPrimaryDisplay().size.width,
          height: screen.getPrimaryDisplay().size.height
        }
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      const primarySource = sources[0];
      const screenshot = primarySource.thumbnail;
      const pngBuffer = screenshot.toPNG();
      const base64Image = pngBuffer.toString('base64');

      // Send to Claude for text extraction (if OCR fails)
      // This is handled by the renderer process
      return base64Image;
    } catch (error) {
      logger.error('Failed to capture screen for Claude:', error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    try {
      if (this.worker) {
        await this.worker.terminate();
        this.worker = null;
        this.isInitialized = false;
        logger.info('OCR worker cleaned up');
      }
    } catch (error) {
      logger.error('Failed to cleanup OCR worker:', error);
    }
  }
}
