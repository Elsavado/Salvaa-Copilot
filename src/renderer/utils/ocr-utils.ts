import { createWorker } from 'tesseract.js';

let worker: Tesseract.Worker | null = null;

export async function initializeOCR(): Promise<void> {
  try {
    if (!worker) {
      worker = await createWorker('eng');
      console.log('OCR worker initialized');
    }
  } catch (error) {
    console.error('Failed to initialize OCR worker:', error);
    throw error;
  }
}

export async function extractTextFromImage(
  imageData: string | Buffer
): Promise<string> {
  try {
    if (!worker) {
      await initializeOCR();
    }

    if (!worker) {
      throw new Error('OCR worker not available');
    }

    const { data } = await worker.recognize(imageData);
    return data.text;
  } catch (error) {
    console.error('Failed to extract text from image:', error);
    throw error;
  }
}

export async function extractTextFromRegion(
  imageData: string | Buffer,
  region: { x: number; y: number; width: number; height: number }
): Promise<string> {
  try {
    if (!worker) {
      await initializeOCR();
    }

    if (!worker) {
      throw new Error('OCR worker not available');
    }

    const { data } = await worker.recognize(imageData, {
      rectangle: region
    });
    
    return data.text;
  } catch (error) {
    console.error('Failed to extract text from region:', error);
    throw error;
  }
}

export async function cleanupOCR(): Promise<void> {
  try {
    if (worker) {
      await worker.terminate();
      worker = null;
      console.log('OCR worker terminated');
    }
  } catch (error) {
    console.error('Failed to cleanup OCR worker:', error);
  }
}

export function preprocessImageForOCR(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
): void {
  // Increase contrast for better OCR
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    
    // Apply threshold for better contrast
    const threshold = 128;
    const value = gray > threshold ? 255 : 0;
    
    data[i] = value;     // Red
    data[i + 1] = value; // Green
    data[i + 2] = value; // Blue
  }
  
  context.putImageData(imageData, 0, 0);
}
