const byId = id => document.getElementById(id);
const state = byId('state');
const detail = byId('detail');
const buttons = ['install', 'remove', 'launch', 'refresh'].map(byId);
const labels = {
  install: 'Устанавливаю VR-мод…',
  remove: 'Восстанавливаю файлы игры…',
  launch: 'Проверяю SteamVR…'
};

async function refresh(result = {}) {
  const current = await window.launcher.state();
  const error = result.error || current.error;
  state.textContent = result.error ? 'Действие не выполнено' :
    !current.supported ? 'Игра недоступна' :
    current.installed ? 'VR-мод установлен' : 'VR-мод не установлен';
  state.className = 'state' + (error ? ' error' : current.installed ? ' ready' : '');
  detail.textContent = error || result.message || 'GoreBox 27 · сборка 0.16.3';
  byId('install').hidden = !current.supported || current.installed;
  byId('launch').hidden = byId('remove').hidden = !current.supported || !current.installed;
  byId('refresh').hidden = current.supported;
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    for (const control of buttons) control.disabled = true;
    state.textContent = labels[button.id] || 'Проверяю установку…';
    state.className = 'state checking';
    try {
      await refresh(button.id === 'refresh' ? {} : await window.launcher.action(button.id));
    } finally {
      for (const control of buttons) control.disabled = false;
    }
  });
}
window.launcher.progress(message => { detail.textContent = message; });
for (const id of ['minimize', 'close']) byId(id).addEventListener('click', () => window.launcher.window(id));

const thumbnails = [...document.querySelectorAll('.gallery button')];
const scene = byId('scene');
for (const button of thumbnails) {
  button.addEventListener('click', () => {
    for (const thumb of thumbnails) {
      thumb.classList.toggle('selected', thumb === button);
      thumb.setAttribute('aria-pressed', thumb === button);
    }
    scene.src = button.querySelector('img').src;
    scene.classList.remove('swap');
    void scene.offsetWidth;
    scene.classList.add('swap');
  });
}
refresh();
