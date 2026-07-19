import { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, screen, desktopCapturer } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Anthropic from '@anthropic-ai/sdk'; // Added Anthropic SDK
import { AudioCaptureService } from './audio-capture';
import { InterviewDetector } from './interview-detector';
import { ScreenReaderService } from './screen-reader';
import { StorageService } from './storage';
import { STTPipeline } from './stt-pipeline';
import { logger } from './logger';

class SalvaaaCopilotApp {
  private mainWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private audioCapture: AudioCaptureService;
  private interviewDetector: InterviewDetector;
  private screenReader: ScreenReaderService;
  private storage: StorageService;
  private sttPipeline: STTPipeline;
  private anthropic: Anthropic | null = null; // Added Anthropic container
  private isOverlayVisible: boolean = true;
  private isInterviewActive: boolean = false;
  private isInitialized: boolean = false; // Safety flag to prevent double starts

  constructor() {
    this.audioCapture = new AudioCaptureService();
    this.interviewDetector = new InterviewDetector();
    this.screenReader = new ScreenReaderService();
    this.storage = new StorageService();
    this.sttPipeline = new STTPipeline();

    if (typeof (this.audioCapture as any).onActivityChange === 'function') {
      (this.audioCapture as any).onActivityChange((isActive: boolean) => {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.overlayWindow.webContents.send('audio-activity-changed', isActive);
        }
      });
    }

    this.setupErrorHandlers();
    this.setupIPC();
    this.setupTranscriptionBridge(); // Wire up the pipeline bridge
  }

  /**
   * Listens to incoming transcripts from the STT pipeline and forwards them to Claude 4.5 Haiku,
   * then streams the answers directly to the overlay window.
   */
  private setupTranscriptionBridge(): void {
    this.sttPipeline.setOnTranscription(async (transcript: string) => {
      // Guard clauses to make sure we should actually generate responses
      if (!this.isInterviewActive || !transcript.trim()) return;
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;

      try {
        if (!this.anthropic) {
          const settings = await this.storage.getSettings();
          if (!settings.anthropicApiKey) {
            logger.warn('Anthropic API key missing in settings. Cannot fetch copiloting answers.');
            return;
          }
          this.anthropic = new Anthropic({ apiKey: settings.anthropicApiKey });
        }

        // Notify UI that a response is cooking
        this.overlayWindow.webContents.send('claude-loading', true);

        const cvData = await this.storage.getCVData();
        const preflightData = await this.storage.getPreFlightData();

        const systemPrompt = `You are Salvaaa Copilot, an elite technical interview assistant. 
Your job is to analyze live audio transcripts from an interview and provide optimized, hyper-concise answers, talking points, or code solutions directly to the candidate's overlay.

Candidate Background Context:
${cvData ? JSON.stringify(cvData) : 'None provided'}

Company/Role Details:
${preflightData ? JSON.stringify(preflightData) : 'None provided'}

CRITICAL DIRECTIONS:
1. Provide highly practical, scannable, structural bullet points or short code blocks.
2. Keep text to the absolute minimum required to be helpful under pressure.
3. Ignore casual filler speech or irrelevant fragments in the transcript.`;

        const stream = await this.anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Live Transcript Fragment: "${transcript}"` }],
          stream: true,
        });

        // Clear previous answers on the screen before feeding the fresh response stream
        this.overlayWindow.webContents.send('claude-clear');

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const token = chunk.delta.text;
            if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
              this.overlayWindow.webContents.send('claude-token', token);
            }
          }
        }
      } catch (error) {
        logger.error('Error during Claude streaming compilation:', error);
      } finally {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.overlayWindow.webContents.send('claude-loading', false);
        }
      }
    });
  }

  private setupErrorHandlers(): void {
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.handleCriticalError(error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    });

    process.on('exit', (code) => {
      logger.info(`Process exiting with code: ${code}`);
      this.cleanup();
    });
  }

  private async handleCriticalError(error: Error): Promise<void> {
    try {
      logger.error('Critical error handler invoked:', error.message);
      await this.storage.saveEmergencyState();
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('critical-error', {
          message: 'An unexpected error occurred. The application will attempt to recover.',
          error: error.message
        });
      }
    } catch (err) {
      logger.error('Error handler failed:', err);
    }
  }

  private cleanup(): void {
    try {
      this.audioCapture.stopCapture();
      this.sttPipeline.stopTranscription();
      this.interviewDetector.stopMonitoring();
      
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.close();
      }
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.close();
      }
      
      if (this.tray) {
        this.tray.destroy();
      }
    } catch (error) {
      logger.error('Cleanup error:', error);
    }
  }

  private setupIPC(): void {
    ipcMain.handle('get-app-settings', async () => {
      try {
        return await this.storage.getSettings();
      } catch (error) {
        logger.error('Failed to get settings:', error);
        throw error;
      }
    });

    ipcMain.handle('save-app-settings', async (_, settings) => {
      try {
        await this.storage.saveSettings(settings);
        // Force re-instantiation of Anthropic next run if API key changes
        this.anthropic = null;
        return { success: true };
      } catch (error) {
        logger.error('Failed to save settings:', error);
        throw error;
      }
    });

    ipcMain.handle('get-cv-data', async () => {
      try {
        return await this.storage.getCVData();
      } catch (error) {
        logger.error('Failed to get CV data:', error);
        return null;
      }
    });

    ipcMain.handle('save-cv-data', async (_, cvData) => {
      try {
        await this.storage.saveCVData(cvData);
        return { success: true };
      } catch (error) {
        logger.error('Failed to save CV data:', error);
        throw error;
      }
    });

    ipcMain.handle('get-preflight-data', async () => {
      try {
        return await this.storage.getPreFlightData();
      } catch (error) {
        logger.error('Failed to get preflight data:', error);
        return null;
      }
    });

    ipcMain.handle('save-preflight-data', async (_, preflightData) => {
      try {
        await this.storage.savePreFlightData(preflightData);
        return { success: true };
      } catch (error) {
        logger.error('Failed to save preflight data:', error);
        throw error;
      }
    });

    ipcMain.handle('toggle-overlay', async () => {
      try {
        this.handleToggleOverlay();
        return { visible: this.isOverlayVisible };
      } catch (error) {
        logger.error('Failed to toggle overlay:', error);
        throw error;
      }
    });

    ipcMain.handle('start-audio-capture', async () => {
      try {
        this.isInterviewActive = true;
        await this.audioCapture.startCapture();
        this.sttPipeline.startTranscription();

        if (this.overlayWindow) {
          this.overlayWindow.webContents.send('interview-status-changed', { active: true });
        }
        return { success: true };
      } catch (error) {
        logger.error('Failed to update interview start state:', error);
        throw error;
      }
    });

    ipcMain.handle('stop-audio-capture', async () => {
      try {
        this.isInterviewActive = false;
        this.audioCapture.stopCapture();
        this.sttPipeline.stopTranscription();

        if (this.overlayWindow) {
          this.overlayWindow.webContents.send('interview-status-changed', { active: false });
        }
        return { success: true };
      } catch (error) {
        logger.error('Failed to update interview stop state:', error);
        throw error;
      }
    });

    ipcMain.handle('get-desktop-source-id', async () => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        return sources.length > 0 ? sources[0].id : null;
      } catch (error) {
        logger.error('Failed to get desktop source ID:', error);
        return null;
      }
    });

    ipcMain.handle('read-screen', async () => {
      try {
        const text = await this.screenReader.captureAndRead();
        return { text };
      } catch (error) {
        logger.error('Failed to read screen:', error);
        throw error;
      }
    });

    ipcMain.handle('get-interview-status', async () => {
      return { active: this.isInterviewActive };
    });

    ipcMain.handle('check-permissions', async () => {
      try {
        return {
          screenCapture: await this.checkScreenCapturePermission(),
          microphone: await this.checkMicrophonePermission(),
          accessibility: await this.checkAccessibilityPermission()
        };
      } catch (error) {
        logger.error('Failed to check permissions:', error);
        throw error;
      }
    });

    ipcMain.handle('request-permission', async (_, permissionType: string) => {
      try {
        const granted = await this.requestSystemPermission(permissionType);
        return { granted };
      } catch (error) {
        logger.error(`Failed to request permission ${permissionType}:`, error);
        throw error;
      }
    });
  }

  private async checkScreenCapturePermission(): Promise<boolean> {
    try {
      const sources = await desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: { width: 1, height: 1 } 
      });
      return sources.length > 0;
    } catch {
      return false;
    }
  }

  private async checkMicrophonePermission(): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        const { systemPreferences } = require('electron');
        return systemPreferences.getMediaAccessStatus('microphone') === 'granted';
      }
      return true;
    } catch {
      return false;
    }
  }

  private async checkAccessibilityPermission(): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        const { systemPreferences } = require('electron');
        return systemPreferences.isTrustedAccessibilityClient(false);
      }
      return true;
    } catch {
      return false;
    }
  }

  private async requestSystemPermission(permissionType: string): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        const { systemPreferences } = require('electron');
        
        switch (permissionType) {
          case 'screenCapture':
            return true;
          case 'microphone':
            return systemPreferences.askForMediaAccess('microphone');
          case 'accessibility':
            systemPreferences.isTrustedAccessibilityClient(true);
            return systemPreferences.isTrustedAccessibilityClient(false);
          default:
            return false;
        }
      }
      return true;
    } catch (error) {
      logger.error(`Failed to request permission ${permissionType}:`, error);
      return false;
    }
  }

  private async startInterviewMode(): Promise<void> {
    try {
      this.isInterviewActive = true;
      await this.audioCapture.startCapture();
      this.sttPipeline.startTranscription();
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('interview-started');
      }
      logger.info('Interview mode activated');
    } catch (error) {
      logger.error('Failed to start interview mode:', error);
    }
  }

  private stopInterviewMode(): void {
    try {
      this.isInterviewActive = false;
      this.audioCapture.stopCapture();
      this.sttPipeline.stopTranscription();
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('interview-ended');
      }
      logger.info('Interview mode deactivated');
    } catch (error) {
      logger.error('Failed to stop interview mode:', error);
    }
  }

  private setupTray(): void {
    try {
      const iconPath = path.join(__dirname, '../../assets/icon.png');
      this.tray = new Tray(iconPath);
      
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show/Hide Overlay',
          click: () => this.handleToggleOverlay()
        },
        { type: 'separator' },
        {
          label: 'Settings',
          click: () => {
            if (this.mainWindow) {
              this.mainWindow.show();
              this.mainWindow.webContents.send('navigate', 'settings');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => app.quit()
        }
      ]);
      
      this.tray.setToolTip('Salvaaa Copilot - A Product of Salvaaa Technical Solutions');
      this.tray.setContextMenu(contextMenu);
      
      this.tray.on('click', () => this.handleToggleOverlay());
    } catch (error) {
      logger.error('Failed to setup tray:', error);
    }
  }

  public handleToggleOverlay(): void {
    try {
      this.isOverlayVisible = !this.isOverlayVisible;
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        if (this.isOverlayVisible) {
          this.overlayWindow.showInactive(); // Prevents stealing keyboard focus
          this.startInterviewMode();
        } else {
          this.overlayWindow.hide();
          this.stopInterviewMode();
        }
      }
    } catch (error) {
      logger.error('Failed to handle toggle overlay:', error);
    }
  }

  private setupGlobalShortcuts(): void {
    try {
      globalShortcut.register('CommandOrControl+Shift+S', () => {
        this.handleToggleOverlay();
      });
      
      globalShortcut.register('CommandOrControl+Shift+R', () => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('read-screen-shortcut');
        }
      });
      
      globalShortcut.register('CommandOrControl+Shift+X', () => {
        if (this.isOverlayVisible && this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.overlayWindow.hide();
          this.isOverlayVisible = false;
          this.stopInterviewMode();
        }
      });
    } catch (error) {
      logger.error('Failed to setup global shortcuts:', error);
    }
  }

  private async createMainWindow(): Promise<void> {
    try {
      this.mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        frame: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false
        },
        icon: path.join(__dirname, '../../assets/icon.png')
      });
      
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
      
      this.mainWindow.once('ready-to-show', () => {
        this.mainWindow?.show();
      });
      
      this.mainWindow.on('closed', () => {
        this.mainWindow = null;
      });
      
      this.mainWindow.setContentProtection(true);
    } catch (error) {
      logger.error('Failed to create main window:', error);
      throw error;
    }
  }

  private async createOverlayWindow(): Promise<void> {
    try {
      const settings = await this.storage.getSettings();
      const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
      
      const targetWidth = settings.overlayWidth || 1000; 
      const targetHeight = 250;                  

      this.overlayWindow = new BrowserWindow({
        width: targetWidth,
        height: targetHeight,
        x: Math.floor((screenWidth - targetWidth) / 2), 
        y: 20,                                          
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,                               
        opacity: settings.overlayOpacity || 0.95,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false
        },
        icon: path.join(__dirname, '../../assets/icon.png')
      });

      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      this.overlayWindow.setContentProtection(true);

      this.overlayWindow.once('ready-to-show', () => {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.overlayWindow.showInactive(); 
        }
      });
      
      this.overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'overlay' });
      
      if (settings.clickThroughMode) {
        this.overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      }
      
      this.overlayWindow.on('closed', () => {
        this.overlayWindow = null;
      });
      
      this.overlayWindow.on('blur', () => {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
        }
      });
    } catch (error) {
      logger.error('Failed to create overlay window:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (this.isInitialized) return; // Halt if already spun up
    
    try {
      logger.info('Starting Salvaaa Copilot...');
      this.isInitialized = true;
      
      await this.storage.initialize();
      await this.createMainWindow();
      await this.createOverlayWindow();
      
      this.setupTray();
      this.setupGlobalShortcuts();
      
      this.interviewDetector.startMonitoring((platform) => {
        logger.info(`Interview detected on ${platform}`);
        this.startInterviewMode();
      }, () => {
        logger.info('Interview ended');
        this.stopInterviewMode();
      });
      
      logger.info('Salvaaa Copilot started successfully');
    } catch (error) {
      logger.error('Failed to start application:', error);
      this.handleCriticalError(error as Error);
    }
  }
}

const salvaAppInstance = new SalvaaaCopilotApp();

app.whenReady().then(() => {
  salvaAppInstance.start();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    salvaAppInstance.start();
  }
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
});
