import { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, screen, desktopCapturer } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
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
  private isOverlayVisible: boolean = true;
  private isInterviewActive: boolean = false;

  constructor() {
    this.audioCapture = new AudioCaptureService();
    this.interviewDetector = new InterviewDetector();
    this.screenReader = new ScreenReaderService();
    this.storage = new StorageService();
    this.sttPipeline = new STTPipeline();

    this.setupErrorHandlers();
    this.setupIPC();
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
      
      // Save state
      await this.storage.saveEmergencyState();
      
      // Notify user
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
        this.isOverlayVisible = !this.isOverlayVisible;
        if (this.overlayWindow) {
          if (this.isOverlayVisible) {
            this.overlayWindow.show();
            this.startInterviewMode();
          } else {
            this.overlayWindow.hide();
            this.stopInterviewMode();
          }
        }
        return { visible: this.isOverlayVisible };
      } catch (error) {
        logger.error('Failed to toggle overlay:', error);
        throw error;
      }
    });

    ipcMain.handle('start-audio-capture', async () => {
      try {
        await this.audioCapture.startCapture();
        return { success: true };
      } catch (error) {
        logger.error('Failed to start audio capture:', error);
        throw error;
      }
    });

    ipcMain.handle('stop-audio-capture', async () => {
      try {
        this.audioCapture.stopCapture();
        return { success: true };
      } catch (error) {
        logger.error('Failed to stop audio capture:', error);
        throw error;
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
        const permissions = {
          screenCapture: await this.checkScreenCapturePermission(),
          microphone: await this.checkMicrophonePermission(),
          accessibility: await this.checkAccessibilityPermission()
        };
        return permissions;
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
      // Check if we can enumerate audio devices
      const { systemPreferences } = require('electron');
      if (process.platform === 'darwin') {
        return systemPreferences.getMediaAccessStatus('microphone') === 'granted';
      }
      return true; // Windows/Linux handle differently
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
            // macOS screen recording permission is requested via the system dialog
            // when we try to capture the screen
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
      return true; // Other platforms handle differently
    } catch (error) {
      logger.error(`Failed to request permission ${permissionType}:`, error);
      return false;
    }
  }

  private async startInterviewMode(): Promise<void> {
    try {
      this.isInterviewActive = true;
      
      // Start system audio capture
      await this.audioCapture.startCapture();
      
      // Start STT pipeline
      this.sttPipeline.startTranscription();
      
      // Notify renderer
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
          click: () => {
            this.handleToggleOverlay();
          }
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
          click: () => {
            app.quit();
          }
        }
      ]);
      
      this.tray.setToolTip('Salvaaa Copilot - A Product of Salvaaa Technical Solutions');
      this.tray.setContextMenu(contextMenu);
      
      this.tray.on('click', () => {
        this.handleToggleOverlay();
      });
    } catch (error) {
      logger.error('Failed to setup tray:', error);
    }
  }

  private handleToggleOverlay(): void {
    try {
      this.isOverlayVisible = !this.isOverlayVisible;
      if (this.overlayWindow) {
        if (this.isOverlayVisible) {
          this.overlayWindow.show();
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
      // Toggle overlay
      globalShortcut.register('CommandOrControl+Shift+S', () => {
        this.handleToggleOverlay();
      });
      
      // Read screen
      globalShortcut.register('CommandOrControl+Shift+R', () => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('read-screen-shortcut');
        }
      });
      
      // Quick hide
      globalShortcut.register('Escape', () => {
        if (this.isOverlayVisible && this.overlayWindow) {
          this.overlayWindow.hide();
          this.isOverlayVisible = false;
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
      
      
    // Prevent the window from appearing in screenshots/screen sharing
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
      
      const targetWidth = settings.overlayWidth || 800; // Making it wide like a toolbar
      const targetHeight = 60;                          // Shorter height so it sits nicely at the top

      this.overlayWindow = new BrowserWindow({
        width: targetWidth,
        height: targetHeight,
        x: Math.floor((screenWidth - targetWidth) / 2), // Perfectly centers it at the top of your screen
        y: 20,                                          // Position it just a little bit down from the very top
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,                               // Keep the toolbar size locked
        opacity: settings.overlayOpacity || 0.95,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false
        },
        icon: path.join(__dirname, '../../assets/icon.png')
      });

     // Crucial OS-level overrides to force it to float above browsers & full-screen apps:
      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      
      // Load overlay HTML
      this.overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'overlay' });

      // PASTE THIS EXACT BLOCK RIGHT HERE 
      this.overlayWindow.once('ready-to-show', () => {
        if (this.overlayWindow) {
          this.overlayWindow.showInactive(); 
        }
      });
      
      // Set content protection to prevent screen sharing capture
      this.overlayWindow.setContentProtection(true);
      
      // Enable click-through mode if configured
      if (settings.clickThroughMode) {
        this.overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      }
      
      this.overlayWindow.on('closed', () => {
        this.overlayWindow = null;
      });
      
      // Handle window blur to maintain always-on-top visually without stealing keyboard focus
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
    try {
      logger.info('Starting Salvaaa Copilot...');
      
      // Initialize storage
      await this.storage.initialize();
      
      // Create windows
      await this.createMainWindow();
      await this.createOverlayWindow();
      
      // Setup tray
      this.setupTray();
      
      // Setup global shortcuts
      this.setupGlobalShortcuts();
      
      // Start interview detection
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

// Application entry point
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
