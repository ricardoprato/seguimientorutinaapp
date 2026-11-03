// Excalidraw-style local file: the app stays linked to one .json file and autosaves into it.
// Requires the File System Access API (Chromium desktop/Android). Elsewhere `supported` is false.

const DB = 'rutina-fs';
const KEY = 'handle';
const PICKER = { types: [{ description: 'Rutina', accept: { 'application/json': ['.json'] } }] };

export const supported = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      try {
        const tx = open.result.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    };
  });
}

let handle = null;
export const state = { name: null, status: 'none', savedAt: null, error: null }; // none | needs-permission | linked

export async function restore() {
  if (!supported) return null;
  handle = (await idb('readonly', (s) => s.get(KEY)).catch(() => null)) ?? null;
  if (!handle) return null;
  state.name = handle.name;
  state.status = (await handle.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'linked' : 'needs-permission';
  return state.status === 'linked' ? readFile() : null;
}

// Must run inside a user gesture.
export async function reconnect() {
  if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Sin permiso para el archivo.');
  state.status = 'linked';
  return readFile();
}

export async function openExisting() {
  [handle] = await window.showOpenFilePicker(PICKER);
  await link();
  return readFile();
}

export async function createNew(data) {
  handle = await window.showSaveFilePicker({ ...PICKER, suggestedName: 'rutina.json' });
  await link();
  await save(data);
}

export async function unlink() {
  handle = null;
  Object.assign(state, { name: null, status: 'none', savedAt: null, error: null });
  await idb('readwrite', (s) => s.delete(KEY));
}

export async function save(data) {
  if (!handle || state.status !== 'linked') return;
  try {
    const w = await handle.createWritable();
    await w.write(JSON.stringify(data, null, 2));
    await w.close();
    state.savedAt = new Date(); state.error = null;
  } catch (err) {
    state.error = err.message;
  }
}

async function link() {
  state.name = handle.name; state.status = 'linked'; state.error = null;
  // Remembering the handle only saves a re-pick next launch; linking works without it.
  await idb('readwrite', (s) => s.put(handle, KEY)).catch(() => {});
}

async function readFile() {
  const text = await (await handle.getFile()).text();
  return text.trim() ? JSON.parse(text) : null;
}
