const {app, BrowserWindow, ipcMain} = require('electron');
const {readFile, writeFile, rename, unlink, access} = require('node:fs/promises');
const {createHash, randomUUID} = require('node:crypto');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const path = require('node:path');

const exec = promisify(execFile);
const offset = 32823780;
const supportedHash = '4aba38f0dc42e5890a626e33bbffc92be1b5f63e1df20a61131dcd5a810e1ff9';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let window;
let busy = false;

async function locate() {
  let result;
  try {
    result = await exec('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath']);
  } catch {
    throw new Error('Установи Steam и войди в него.');
  }
  const steam = result.stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i)?.[1].trim();
  if (!steam) throw new Error('Не удалось найти папку Steam.');
  const vdf = await readFile(path.join(steam, 'steamapps/libraryfolders.vdf'), 'utf8').catch(() => '');
  const libraries = [steam, ...Array.from(vdf.matchAll(/"path"\s+"([^"]+)"/g), m => m[1].replaceAll('\\\\', '\\'))];
  let game, runtime;
  for (const library of libraries) {
    const common = path.join(library, 'steamapps/common');
    const candidate = path.join(common, 'GoreBox');
    if (!game && await access(path.join(candidate, 'GoreBox.exe')).then(() => true, () => false)) game = candidate;
    if (!runtime && await access(path.join(common, 'SteamVR/bin/win64/openvr_api.dll')).then(() => true, () => false)) {
      runtime = path.join(common, 'SteamVR/bin/win64/openvr_api.dll');
    }
  }
  if (!game) throw new Error('Установи GoreBox и выбери ветку gb27 в Steam.');
  return {steam, runtime, asset: path.join(game, 'GoreBox_Data/globalgamemanagers.assets')};
}

async function inspect(asset) {
  const data = await readFile(asset);
  const value = data[offset];
  if (value !== 0 && value !== 1) throw new Error('Эта сборка GoreBox не поддерживается.');
  data[offset] = 1;
  if (createHash('sha256').update(data).digest('hex') !== supportedHash) {
    throw new Error('Нужна поддерживаемая сборка GB27 0.16.3 (Steam 26471092).');
  }
  return {data, installed: value === 0};
}

async function running(exe) {
  const {stdout} = await exec('tasklist.exe', ['/fi', 'imagename eq ' + exe, '/fo', 'csv', '/nh'], {windowsHide: true});
  return stdout.toLowerCase().includes('"' + exe.toLowerCase() + '"');
}

async function setInstalled(asset, installed) {
  const {data, installed: current} = await inspect(asset);
  if (installed === current) return;
  if (await running('GoreBox.exe')) throw new Error('Закрой GoreBox перед изменением мода.');
  data[offset] = installed ? 0 : 1;
  const staging = asset + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(staging, data, {flag: 'wx'});
    if (await running('GoreBox.exe')) throw new Error('Закрой GoreBox перед изменением мода.');
    await rename(staging, asset);
  } finally {
    await unlink(staging).catch(() => {});
  }
}

async function launch({steam, runtime, asset}) {
  if (!(await inspect(asset)).installed) throw new Error('Сначала установи мод.');
  if (await running('GoreBox.exe')) throw new Error('GoreBox уже запущен.');
  if (!runtime || !(await running('vrserver.exe'))) throw new Error('Сначала запусти SteamVR и подключи Quest через Steam Link.');
  window.webContents.send('progress', 'Проверяю шлем и оба контроллера…');
  const helper = path.join(__dirname, 'TouchReady', 'TouchReady.exe');
  try {
    await exec(helper, [runtime], {windowsHide: true, timeout: 125000});
  } catch (error) {
    if (error.code === 3 || error.code === 4 || error.killed) {
      throw new Error('SteamVR не видит шлем или оба контроллера. Проверь Steam Link.');
    }
    throw new Error('Не удалось запустить проверку контроллеров.');
  }
  if (await running('GoreBox.exe')) throw new Error('GoreBox уже запущен.');
  window.webContents.send('progress', 'Запускаю GoreBox через Steam…');
  execFile(path.join(steam, 'steam.exe'), ['-applaunch', '2027330', '-vr'], {windowsHide: true}, () => {});
  for (let i = 0; i < 45; i++) {
    if (await running('GoreBox.exe')) return 'GoreBox запущен.';
    await delay(1000);
  }
  throw new Error('Steam не запустил GoreBox. Проверь окно выбора запуска.');
}

ipcMain.handle('state', async () => {
  try {
    const {asset} = await locate();
    const {installed} = await inspect(asset);
    return {installed, supported: true};
  } catch (error) {
    return {installed: false, supported: false, error: message(error)};
  }
});

function message(error) {
  if (error.code === 'EACCES' || error.code === 'EPERM') return 'Windows заблокировала запись в папку Steam. Запусти лаунчер от администратора.';
  if (error.code === 'ENOENT') return 'Не найден файл игры или SteamVR. Проверь установку в Steam.';
  return error.message;
}

ipcMain.handle('action', async (_, action) => {
  if (busy) return {error: 'Дождись завершения текущего действия.'};
  busy = true;
  try {
    const installation = await locate();
    switch (action) {
      case 'install':
        await setInstalled(installation.asset, true);
        return {message: 'VR-мод установлен.'};
      case 'remove':
        await setInstalled(installation.asset, false);
        return {message: 'VR-мод удалён.'};
      case 'launch':
        return {message: await launch(installation)};
      default:
        return {error: 'Неизвестное действие.'};
    }
  } catch (error) {
    return {error: message(error)};
  } finally {
    busy = false;
  }
});

ipcMain.on('window', (_, action) => {
  if (action === 'close') window.close();
  if (action === 'minimize') window.minimize();
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.restore(); window?.focus(); });
  app.whenReady().then(() => {
    window = new BrowserWindow({
      width: 1140, height: 735, minWidth: 800, minHeight: 600, frame: false,
      backgroundColor: '#121311', show: false,
      webPreferences: {preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true}
    });
    window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.on('close', event => {
      if (busy) event.preventDefault();
    });
    window.once('ready-to-show', () => window.show());
    window.loadFile('index.html');
  });
  app.on('window-all-closed', () => app.quit());
}
