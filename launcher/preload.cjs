const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('launcher', {
  state: () => ipcRenderer.invoke('state'),
  action: action => ipcRenderer.invoke('action', action),
  window: action => ipcRenderer.send('window', action),
  progress: callback => ipcRenderer.on('progress', (_, message) => callback(message))
});
