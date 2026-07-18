import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { logger } from './logger';
import { AppSettings, CVData, PreFlightData, InterviewSession } from '../shared/types';

export class StorageService {
  private userDataPath: string;
  private settingsPath: string;
  private cvDataPath: string;
  private preflightPath: string;
  private sessionsPath: string;
  private isInitialized: boolean = false;

  constructor() {
    this.userDataPath = app.getPath('userData');
    this.settingsPath = path.join(this.userDataPath, 'settings.json');
    this.cvDataPath = path.join(this.userDataPath, 'cv-data.json');
    this.preflightPath = path.join(this.userDataPath, 'preflight-data.json');
    this.sessionsPath = path.join(this.userDataPath, 'sessions');
  }

  public async initialize(): Promise<void> {
    try {
      // Create data directories if they don't exist
      const dirs = [
        this.userDataPath,
        this.sessionsPath
      ];

      for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // Create default settings if they don't exist
      if (!fs.existsSync(this.settingsPath)) {
        await this.saveSettings(this.getDefaultSettings());
      }

      this.isInitialized = true;
      logger.info('Storage service initialized');
    } catch (error) {
      logger.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  private getDefaultSettings(): AppSettings {
    return {
      anthropicApiKey: '',
      assemblyAiApiKey: '',
      aiModel: 'claude-3-5-sonnet-20241022',
      sttLanguage: 'en',
      overlayOpacity: 0.85,
      overlayWidth: 400,
      overlayHeight: 600,
      audioSource: 'system',
      autoScreenMonitoring: false,
      autoScrollSpeed: 1,
      theme: 'dark',
      fontSize: 14,
      clickThroughMode: false,
      interviewAutoDetect: true,
      onboardingComplete: false
    };
  }

  public async getSettings(): Promise<AppSettings> {
    try {
      if (!fs.existsSync(this.settingsPath)) {
        return this.getDefaultSettings();
      }

      const data = fs.readFileSync(this.settingsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to get settings:', error);
      return this.getDefaultSettings();
    }
  }

  public async saveSettings(settings: AppSettings): Promise<void> {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      logger.info('Settings saved');
    } catch (error) {
      logger.error('Failed to save settings:', error);
      throw error;
    }
  }

  public async getCVData(): Promise<CVData | null> {
    try {
      if (!fs.existsSync(this.cvDataPath)) {
        return null;
      }

      const data = fs.readFileSync(this.cvDataPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to get CV data:', error);
      return null;
    }
  }

  public async saveCVData(cvData: CVData): Promise<void> {
    try {
      fs.writeFileSync(this.cvDataPath, JSON.stringify(cvData, null, 2), 'utf-8');
      logger.info('CV data saved');
    } catch (error) {
      logger.error('Failed to save CV data:', error);
      throw error;
    }
  }

  public async getPreFlightData(): Promise<PreFlightData | null> {
    try {
      if (!fs.existsSync(this.preflightPath)) {
        return null;
      }

      const data = fs.readFileSync(this.preflightPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to get preflight data:', error);
      return null;
    }
  }

  public async savePreFlightData(preflightData: PreFlightData): Promise<void> {
    try {
      fs.writeFileSync(this.preflightPath, JSON.stringify(preflightData, null, 2), 'utf-8');
      logger.info('Preflight data saved');
    } catch (error) {
      logger.error('Failed to save preflight data:', error);
      throw error;
    }
  }

  public async saveSession(session: InterviewSession): Promise<void> {
    try {
      const sessionPath = path.join(this.sessionsPath, `${session.id}.json`);
      fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
      logger.info(`Session ${session.id} saved`);
    } catch (error) {
      logger.error('Failed to save session:', error);
      throw error;
    }
  }

  public async getSession(sessionId: string): Promise<InterviewSession | null> {
    try {
      const sessionPath = path.join(this.sessionsPath, `${sessionId}.json`);
      if (!fs.existsSync(sessionPath)) {
        return null;
      }

      const data = fs.readFileSync(sessionPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to get session:', error);
      return null;
    }
  }

  public async getAllSessions(): Promise<InterviewSession[]> {
    try {
      if (!fs.existsSync(this.sessionsPath)) {
        return [];
      }

      const files = fs.readdirSync(this.sessionsPath);
      const sessions: InterviewSession[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = fs.readFileSync(path.join(this.sessionsPath, file), 'utf-8');
          sessions.push(JSON.parse(data));
        }
      }

      return sessions.sort((a, b) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    } catch (error) {
      logger.error('Failed to get all sessions:', error);
      return [];
    }
  }

  public async saveEmergencyState(): Promise<void> {
    try {
      const emergencyPath = path.join(this.userDataPath, 'emergency-state.json');
      const state = {
        timestamp: new Date().toISOString(),
        settings: await this.getSettings()
      };
      fs.writeFileSync(emergencyPath, JSON.stringify(state, null, 2), 'utf-8');
      logger.info('Emergency state saved');
    } catch (error) {
      logger.error('Failed to save emergency state:', error);
    }
  }
}
