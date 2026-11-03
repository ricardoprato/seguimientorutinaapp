import { emptyRoutine } from './presets.js';
import { parseBackup } from './schema.js';

const KEYS = { routine: 'rutina.routine', logs: 'rutina.logs', draft: 'rutina.draft' };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  if (value == null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

const listeners = [];
const notify = () => listeners.forEach((fn) => fn());
const sortLogs = (logs) => [...logs].sort((a, b) => a.date.localeCompare(b.date));

export const store = {
  onChange: (fn) => listeners.push(fn),
  getRoutine: () => read(KEYS.routine, null) ?? emptyRoutine(),
  saveRoutine: (routine) => { write(KEYS.routine, routine); notify(); },
  getLogs: () => read(KEYS.logs, []),
  saveLogs: (logs) => { write(KEYS.logs, sortLogs(logs)); notify(); },
  getDraft: () => read(KEYS.draft, null),
  saveDraft: (draft) => write(KEYS.draft, draft),

  exportAll: () => ({ app: 'rutina', exportedAt: new Date().toISOString(), routine: store.getRoutine(), logs: store.getLogs() }),
  // Replaces routine and logs without notifying (the data came from the file itself).
  importAll(data) {
    const { routine, logs } = parseBackup(data);
    write(KEYS.routine, routine);
    write(KEYS.logs, sortLogs(logs));
  },
};

export { newId } from './ids.js';
