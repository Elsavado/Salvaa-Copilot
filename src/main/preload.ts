import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-app-settings', settings),
  
  // CV Data
  getCVData: () => ipcRenderer.invoke('get-cv-data'),
  saveCVData: (cvData: any) => ipcRenderer.invoke('save-cv-data', cvData),
  
  // Preflight Data
  getPreFlightData: () => ipcRenderer.invoke('get-preflight-data'),
  savePreFlightData: (preflightData: any) => ipcRenderer.invoke('save-preflight-data', preflightData),
  
  // Overlay Controls
  toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),
  
  // Audio Controls
  startAudioCapture: () => ipcRenderer.invoke('start-audio-capture'),
  stopAudioCapture: () => ipcRenderer.invoke('stop-audio-capture'),
  getDesktopSourceId: () => ipcRenderer.invoke('get-desktop-source-id'),
  
  // Screen Reading
  readScreen: () => ipcRenderer.invoke('read-screen'),
  
  // Interview Status
  getInterviewStatus: () => ipcRenderer.invoke('get-interview-status'),
  
  // Permissions
  checkPermissions: () => ipcRenderer.invoke('check-permissions'),
  requestPermission: (permissionType: string) => ipcRenderer.invoke('request-permission', permissionType),
  
  // Event Listeners
  onInterviewStarted: (callback: () => void) => {
    ipcRenderer.on('interview-started', callback);
    return () => ipcRenderer.removeListener('interview-started', callback);
  },
  onInterviewEnded: (callback: () => void) => {
    ipcRenderer.on('interview-ended', callback);
    return () => ipcRenderer.removeListener('interview-ended', callback);
  },
  onReadScreenShortcut: (callback: () => void) => {
    ipcRenderer.on('read-screen-shortcut', callback);
    return () => ipcRenderer.removeListener('read-screen-shortcut', callback);
  },
  onCriticalError: (callback: (error: any) => void) => {
    ipcRenderer.on('critical-error', (_, error) => callback(error));
    return () => ipcRenderer.removeListener('critical-error', callback);
  },
  onNavigate: (callback: (event: any, route: string) => void) => {
    ipcRenderer.on('navigate', (_, route) => callback(_, route));
    return () => ipcRenderer.removeListener('navigate', callback);
  }
});
