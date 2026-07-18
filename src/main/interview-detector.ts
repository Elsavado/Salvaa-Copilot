import { exec } from 'child_process';
import { logger } from './logger';

interface PlatformProcess {
  name: string;
  processes: string[];
  windows: string[];
  urls?: string[];
}

export class InterviewDetector {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  private onInterviewStart: ((platform: string) => void) | null = null;
  private onInterviewEnd: (() => void) | null = null;
  private currentPlatform: string | null = null;
  private interviewActive: boolean = false;

  private readonly PLATFORMS: PlatformProcess[] = [
    {
      name: 'Zoom',
      processes: ['zoom', 'Zoom'],
      windows: ['Zoom Meeting', 'Zoom -'],
      urls: ['zoom.us']
    },
    {
      name: 'Google Meet',
      processes: ['chrome', 'google-chrome', 'chromium', 'msedge', 'firefox', 'safari'],
      windows: ['Google Meet', 'Meet -'],
      urls: ['meet.google.com']
    },
    {
      name: 'Microsoft Teams',
      processes: ['teams', 'ms-teams', 'Teams'],
      windows: ['Microsoft Teams', 'Teams -'],
      urls: ['teams.microsoft.com']
    },
    {
      name: 'Webex',
      processes: ['webex', 'Webex'],
      windows: ['Webex Meeting', 'Webex -'],
      urls: ['webex.com']
    },
    {
      name: 'Skype',
      processes: ['skype', 'Skype'],
      windows: ['Skype Call', 'Skype -'],
      urls: ['skype.com']
    },
    {
      name: 'GoTo Meeting',
      processes: ['gotomeeting', 'GoToMeeting'],
      windows: ['GoToMeeting', 'GoTo Meeting'],
      urls: ['gotomeeting.com']
    },
    {
      name: 'Discord',
      processes: ['discord', 'Discord'],
      windows: ['Discord', 'Voice Channel'],
      urls: ['discord.com']
    },
    {
      name: 'Riverside',
      processes: ['chrome', 'google-chrome', 'chromium'],
      windows: ['Riverside'],
      urls: ['riverside.fm']
    },
    {
      name: 'Slack Huddles',
      processes: ['slack', 'Slack'],
      windows: ['Slack Call', 'Huddle'],
      urls: ['slack.com']
    },
    {
      name: 'BlueJeans',
      processes: ['bluejeans', 'BlueJeans'],
      windows: ['BlueJeans Meeting'],
      urls: ['bluejeans.com']
    },
    {
      name: 'Jitsi',
      processes: ['chrome', 'google-chrome', 'chromium', 'firefox'],
      windows: ['Jitsi Meet'],
      urls: ['meet.jit.si']
    },
    {
      name: 'Whereby',
      processes: ['chrome', 'google-chrome', 'chromium'],
      windows: ['Whereby'],
      urls: ['whereby.com']
    },
    {
      name: 'Micro1',
      processes: ['chrome', 'google-chrome', 'chromium', 'firefox'],
      windows: ['Micro1', 'Interview'],
      urls: ['micro1.ai', 'app.micro1.ai']
    },
    {
      name: 'HireVue',
      processes: ['chrome', 'google-chrome', 'chromium'],
      windows: ['HireVue'],
      urls: ['hirevue.com']
    },
    {
      name: 'CoderPad',
      processes: ['chrome', 'google-chrome', 'chromium'],
      windows: ['CoderPad'],
      urls: ['coderpad.io']
    },
    {
      name: 'Pramp',
      processes: ['chrome', 'google-chrome', 'chromium'],
      windows: ['Pramp'],
      urls: ['pramp.com']
    },
    {
      name: 'Interviewing.io',
      processes: ['chrome', 'google-chrome', 'chromium'],
      windows: ['Interviewing.io'],
      urls: ['interviewing.io']
    },
    {
      name: 'Karat',
      processes: ['chrome', 'google-chrome', 'chromium'],
      windows: ['Karat'],
      urls: ['karat.com']
    },
    {
      name: 'Triplebyte',
      processes: ['chrome', 'google-chrome', 'chromium'],
      windows: ['Triplebyte'],
      urls: ['triplebyte.com']
    }
  ];

  public startMonitoring(
    onStart: (platform: string) => void,
    onEnd: () => void
  ): void {
    this.onInterviewStart = onStart;
    this.onInterviewEnd = onEnd;
    this.isMonitoring = true;

    // Check every 2 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkForInterviews();
    }, 2000);

    logger.info('Interview detection monitoring started');
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    this.interviewActive = false;
    this.currentPlatform = null;
    logger.info('Interview detection monitoring stopped');
  }

  private async checkForInterviews(): Promise<void> {
    try {
      const activePlatform = await this.detectActivePlatform();

      if (activePlatform && !this.interviewActive) {
        // Interview just started
        this.interviewActive = true;
        this.currentPlatform = activePlatform;
        logger.info(`Interview detected on ${activePlatform}`);
        
        if (this.onInterviewStart) {
          this.onInterviewStart(activePlatform);
        }
      } else if (!activePlatform && this.interviewActive) {
        // Interview just ended
        this.interviewActive = false;
        this.currentPlatform = null;
        logger.info('Interview ended');
        
        if (this.onInterviewEnd) {
          this.onInterviewEnd();
        }
      }
    } catch (error) {
      logger.error('Error checking for interviews:', error);
    }
  }

  private async detectActivePlatform(): Promise<string | null> {
    try {
      const activeProcesses = await this.getActiveProcesses();
      const activeWindows = await this.getActiveWindows();

      for (const platform of this.PLATFORMS) {
        // Check for running processes
        const hasProcess = platform.processes.some(proc => 
          activeProcesses.some(p => p.toLowerCase().includes(proc.toLowerCase()))
        );

        // Check for matching windows
        const hasWindow = platform.windows.some(win =>
          activeWindows.some(w => w.toLowerCase().includes(win.toLowerCase()))
        );

        if (hasProcess || hasWindow) {
          return platform.name;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error detecting platform:', error);
      return null;
    }
  }

  private async getActiveProcesses(): Promise<string[]> {
    return new Promise((resolve) => {
      const platform = process.platform;
      let command: string;

      switch (platform) {
        case 'win32':
          command = 'tasklist /FO CSV /NH';
          break;
        case 'darwin':
          command = 'ps aux';
          break;
        case 'linux':
          command = 'ps aux';
          break;
        default:
          resolve([]);
          return;
      }

      exec(command, (error, stdout) => {
        if (error) {
          logger.error('Failed to get processes:', error);
          resolve([]);
          return;
        }

        const processes = stdout
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            if (platform === 'win32') {
              const parts = line.split(',');
              return parts[0]?.replace(/"/g, '').trim() || '';
            }
            return line.split(/\s+/).pop() || '';
          })
          .filter(p => p);

        resolve(processes);
      });
    });
  }

  private async getActiveWindows(): Promise<string[]> {
    return new Promise((resolve) => {
      const platform = process.platform;
      let command: string;

      switch (platform) {
        case 'win32':
          command = 'powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne \"\"} | Select-Object -ExpandProperty MainWindowTitle"';
          break;
        case 'darwin':
          command = `osascript -e 'tell application "System Events" to get name of every process whose visible is true'`;
          break;
        case 'linux':
          command = 'wmctrl -l';
          break;
        default:
          resolve([]);
          return;
      }

      exec(command, (error, stdout) => {
        if (error) {
          logger.error('Failed to get windows:', error);
          resolve([]);
          return;
        }

        const windows = stdout
          .split('\n')
          .filter(line => line.trim())
          .map(line => line.trim());

        resolve(windows);
      });
    });
  }

  public getCurrentPlatform(): string | null {
    return this.currentPlatform;
  }

  public isInterviewActive(): boolean {
    return this.interviewActive;
  }

  public isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}
