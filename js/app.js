import { store, newId } from './store.js';
import { suggest, findLastEntry } from './progression.js';
import { toCsv, toClaudeMarkdown, ACTION_LABEL, formatSet, formatTarget } from './export.js';
import { PRESETS, buildRoutine } from './presets.js';
import * as fileSync from './file-sync.js';
import { exerciseSeries, streaks, heatmapWeeks } from './stats.js';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const VIEWS = ['train', 'history', 'routine', 'data'];
const $view = document.getElementById('view');

let routine = store.getRoutine();
let logs = store.getLogs();
let draft = null;
let editDayId = null;
let claudeWeeks = 8;
let chartExId = null;
const HEAT_WEEKS = 26;
const openEx = new Set();

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const fmtDate = (iso) => { const d = new Date(`${iso}T00:00:00`); return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`; };
const num = (v) => (v === '' || v == null ? null : Number(v));
const findEx = (id) => routine.days.flatMap((d) => d.exercises).find((e) => e.id === id);
const dayOf = (id) => routine.days.find((d) => d.id === id);
const empty = (text) => `<p class="empty">${esc(text)}</p>`;

let toastId;
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toastId); toastId = setTimeout(() => { el.hidden = true; }, 2200);
}

function saveRoutine() { store.saveRoutine(routine); }

// ---------- draft (session in progress) ----------
function currentDraft() {
  if (draft) return draft;
  draft = store.getDraft();
  const hasWork = draft && Object.values(draft.entries).some((e) => e.sets.some((s) => s.done));
  if (!draft || !dayOf(draft.dayId) || (draft.date !== todayIso() && !hasWork)) {
    const today = routine.days.find((d) => d.weekday === new Date().getDay()) ?? routine.days[0];
    draft = { date: todayIso(), dayId: today?.id ?? null, entries: {} };
  }
  return draft;
}
const persistDraft = () => store.saveDraft(draft);

function entryFor(ex) {
  const d = currentDraft();
  const e = (d.entries[ex.id] ??= { sets: [], rir: null });
  while (e.sets.length < ex.sets) e.sets.push({ kg: null, reps: null, done: false });
  return e;
}

// ---------- timer (rest countdown / work stopwatch) ----------
const timerEl = document.getElementById('timer');
const timeEl = document.getElementById('timer-time');
const labelEl = document.getElementById('timer-label');
let timer = null;
let tickId = null;
let audioCtx = null;

function startTimer(t) {
  timer = t; timerEl.hidden = false;
  clearInterval(tickId); tickId = setInterval(tick, 250); tick();
}
function stopTimer() {
  timer = null; timerEl.hidden = true; timerEl.classList.remove('over'); clearInterval(tickId);
}
function tick() {
  if (!timer) return;
  const now = Date.now();
  if (timer.mode === 'rest') {
    const rem = Math.round((timer.at - now) / 1000);
    timerEl.classList.toggle('over', rem <= 0);
    timeEl.textContent = (rem < 0 ? '+' : '') + fmtTime(Math.abs(rem));
    labelEl.textContent = rem > 0 ? timer.label : 'A la siguiente serie';
    if (rem <= 0 && !timer.alerted) { timer.alerted = true; alertUser(); }
    if (rem < -90) stopTimer();
  } else {
    timeEl.textContent = fmtTime(Math.floor((now - timer.at) / 1000));
    labelEl.textContent = timer.label;
  }
}
function startRest(ex) {
  if (ex.restSec > 0) startTimer({ mode: 'rest', at: Date.now() + ex.restSec * 1000, label: `Descanso · ${ex.name}`, alerted: false });
}
function alertUser() {
  navigator.vibrate?.([250, 120, 250]);
  if (!audioCtx) return;
  [0, 0.35].forEach((t) => {
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.frequency.value = 880; gain.gain.value = 0.15;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + t); osc.stop(audioCtx.currentTime + t + 0.2);
  });
}
document.getElementById('timer-add').addEventListener('click', () => {
  if (timer?.mode !== 'rest') return;
  timer.at = Math.max(timer.at, Date.now()) + 15000; timer.alerted = false; tick();
});
document.getElementById('timer-skip').addEventListener('click', () => {
  if (timer?.mode === 'work') timer.onDone(); else stopTimer();
});

let wakeLock = null;
async function keepAwake() {
  try { if (!wakeLock && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock?.request('screen'); wakeLock?.addEventListener('release', () => { wakeLock = null; }); } catch { /* not supported */ }
}
document.addEventListener('visibilitychange', () => { if (timer) keepAwake(); });

// ---------- views ----------
function render() {
  const view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'train';
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-current', t.dataset.view === view ? 'page' : 'false'));
  ({ train: renderTrain, history: renderHistory, routine: renderRoutine, data: renderData })[view]();
}

function renderTrain() {
  const d = currentDraft();
  const day = dayOf(d.dayId);
  if (!day) {
    $view.innerHTML = `<h2>Elegí una plantilla para empezar</h2>
      <p class="muted">Después podés cambiar ejercicios, series, reps y descansos en la pestaña Rutina.</p>
      ${presetList(false)}
      <button class="btn ghost block" data-action="start-blank">Prefiero armarla desde cero</button>`;
    return;
  }
  const chips = routine.days.map((x) => `<button class="chip" data-action="pick-day" data-id="${x.id}" aria-pressed="${x.id === day.id}">${esc(x.name)}</button>`).join('');
  const doneCount = day.exercises.reduce((n, ex) => n + entryFor(ex).sets.filter((s) => s.done).length, 0);
  $view.innerHTML = `
    ${fileBanner()}
    <div class="chips">${chips}</div>
    <div class="row spread"><h2>${esc(day.name)}</h2>
      <input type="date" class="inline auto-w" id="draft-date" value="${d.date}" aria-label="Fecha de la sesión"></div>
    ${day.exercises.map(exerciseCard).join('') || empty('Este día no tiene ejercicios. Agregalos en la pestaña Rutina.')}
    <label class="lbl">Notas de la sesión (sueño, energía, molestias)<textarea rows="2" id="draft-note" maxlength="500">${esc(d.note ?? '')}</textarea></label>
    <button class="btn block" data-action="finish" ${doneCount ? '' : 'disabled'}>Guardar sesión (${doneCount} series)</button>
    <button class="btn danger block" data-action="discard" data-confirm="Tocá de nuevo para descartar">Descartar sesión</button>`;
}

function exerciseCard(ex) {
  const e = entryFor(ex);
  const last = findLastEntry(logs, ex.id);
  const sug = suggest(ex, last);
  const isTime = ex.type === 'time';
  const badge = `<span class="badge ${sug.action}">${ACTION_LABEL[sug.action]}${sug.kg != null && sug.action !== 'hold' ? ` → ${sug.kg} kg` : ''}</span>`;
  const lastLine = last
    ? `Última: ${last.sets.filter((s) => s.done).map((s) => formatSet(s, ex.type)).join(' · ')}${last.rir != null ? ` · RIR ${last.rir}` : ''}`
    : 'Primera vez: elegí una carga con la que llegues al rango dejando 1–2 reps en reserva.';
  let carryKg = sug.kg;
  const rows = e.sets.map((s, i) => {
    const phKg = carryKg;
    if (s.kg != null) carryKg = s.kg;
    const running = timer?.mode === 'work' && timer.key === `${ex.id}:${i}`;
    const attrs = `data-ex="${ex.id}" data-i="${i}"`;
    return `<div class="set ${isTime ? 'time' : ''} ${s.done ? 'done' : ''}">
      <span class="set-n">${i + 1}</span>
      <div class="field"><input type="number" inputmode="decimal" step="0.5" min="-200" data-field="kg" ${attrs} value="${s.kg ?? ''}" placeholder="${phKg ?? ''}" aria-label="Kg serie ${i + 1}"><span class="unit">kg</span></div>
      <div class="field"><input type="number" inputmode="numeric" min="0" data-field="reps" ${attrs} value="${s.reps ?? ''}" placeholder="${ex.max}" aria-label="${isTime ? 'Segundos' : 'Reps'} serie ${i + 1}"><span class="unit">${isTime ? 's' : 'reps'}</span></div>
      ${isTime ? `<button class="icon-btn ${running ? 'running' : ''}" data-action="stopwatch" ${attrs} aria-label="Cronometrar serie ${i + 1}">${running ? '■' : '▶'}</button>` : ''}
      <button class="check" data-action="toggle-set" ${attrs} aria-pressed="${s.done}" aria-label="Serie ${i + 1} hecha">✓</button>
    </div>`;
  }).join('');
  const rirOpts = ['', 0, 1, 2, 3, 4].map((v) => `<option value="${v}" ${String(e.rir ?? '') === String(v) ? 'selected' : ''}>${v === '' ? '–' : v}</option>`).join('');
  const complete = e.sets.length && e.sets.every((s) => s.done);
  return `<section class="card ${complete ? 'complete' : ''}">
    <div class="row spread"><h3>${esc(ex.name)}</h3>${badge}</div>
    <div class="target">${formatTarget(ex)} · descanso ${fmtTime(ex.restSec)}${ex.incKg ? ` · +${ex.incKg} kg al subir` : ''}</div>
    <div class="last">${esc(lastLine)}</div>
    ${ex.notes ? `<div class="notes">${esc(ex.notes)}</div>` : ''}
    <div class="sets">${rows}</div>
    <div class="row spread">
      <label class="row small muted">RIR última serie <select class="inline auto-w" data-field="rir" data-ex="${ex.id}">${rirOpts}</select></label>
      <button class="btn ghost" data-action="add-set" data-ex="${ex.id}">+ serie</button>
    </div>
  </section>`;
}

function renderHistory() {
  if (!logs.length) { $view.innerHTML = `<h2>Historial</h2>${empty('Todavía no guardaste sesiones. Cuando termines una, tocá "Guardar sesión".')}`; return; }
  const items = [...logs].reverse().map((l) => `
    <details class="card log-item">
      <summary><span><strong>${fmtDate(l.date)}</strong> · ${esc(l.dayName)}</span><span class="muted small">${l.exercises.length} ejercicios</span></summary>
      ${l.note ? `<p class="small notes">${esc(l.note)}</p>` : ''}
      <ul>${l.exercises.map((e) => `<li>${esc(e.name)}: ${e.sets.map((s) => formatSet(s, e.type)).join(', ')}${e.rir != null ? ` (RIR ${e.rir})` : ''}</li>`).join('')}</ul>
      <button class="btn danger" data-action="delete-log" data-id="${l.id}" data-confirm="Tocá de nuevo para borrar">Borrar sesión</button>
    </details>`).join('');
  $view.innerHTML = `<h2>Historial</h2>${streakCard()}${progressCard()}<h3>Sesiones</h3>${items}`;
}

function streakCard() {
  const today = todayIso();
  const counts = logs.reduce((m, l) => m.set(l.date, (m.get(l.date) ?? 0) + 1), new Map());
  const { current, longest } = streaks([...counts.keys()], today);
  const weeks = heatmapWeeks(today, HEAT_WEEKS);
  const total = weeks.flat().filter((d) => counts.has(d)).length;
  const cell = 10; const gap = 2; const step = cell + gap;
  const rects = weeks.flatMap((week, w) => week.map((date, d) => {
    if (!date) return '';
    const n = counts.get(date) ?? 0;
    return `<rect x="${w * step}" y="${d * step}" width="${cell}" height="${cell}" rx="2" class="l${Math.min(n, 2)}${date === today ? ' today' : ''}" data-action="chart-tip" data-tip="${fmtDate(date)}: ${n ? `${n} ${n === 1 ? 'sesión' : 'sesiones'}` : 'descanso'}"><title>${fmtDate(date)}</title></rect>`;
  })).join('');
  return `<section class="card">
    <div class="stats">
      <div><span class="stat-num">${current}</span><span class="muted small">${current === 1 ? 'día' : 'días'} de racha</span></div>
      <div><span class="stat-num">${longest}</span><span class="muted small">mejor racha</span></div>
      <div><span class="stat-num">${total}</span><span class="muted small">días en ${HEAT_WEEKS} semanas</span></div>
    </div>
    <svg class="heat" viewBox="0 0 ${HEAT_WEEKS * step - gap} ${7 * step - gap}" role="img" aria-label="Días entrenados en las últimas ${HEAT_WEEKS} semanas">${rects}</svg>
    <p class="muted small">Cada cuadrado es un día, de lunes (arriba) a domingo. Tocalo para ver la fecha.</p>
  </section>`;
}

function progressCard() {
  const names = new Map();
  for (const l of logs) for (const e of l.exercises) names.set(e.exId, findEx(e.exId)?.name ?? e.name);
  if (!names.has(chartExId)) chartExId = [...names.keys()].find((id) => findEx(id)) ?? [...names.keys()][0];
  const opts = [...names].sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, name]) => `<option value="${id}" ${id === chartExId ? 'selected' : ''}>${esc(name)}</option>`).join('');
  const isTime = logs.flatMap((l) => l.exercises).find((e) => e.exId === chartExId)?.type === 'time';
  return `<section class="card">
    <h3>Progreso</h3>
    <select id="chart-ex" aria-label="Ejercicio">${opts}</select>
    ${progressChart(exerciseSeries(logs, chartExId), isTime)}
  </section>`;
}

function progressChart(points, isTime) {
  if (!points.length) return empty('Sin series registradas para este ejercicio.');
  const byKg = points.some((p) => p.kg != null);
  const unit = byKg ? 'kg' : isTime ? 's' : 'reps';
  const data = points.filter((p) => (byKg ? p.kg != null : true)).map((p) => ({ ...p, v: byKg ? p.kg : p.reps }));
  const W = 320; const H = 170; const L = 36; const R = 14; const T = 18; const B = 24;
  const xs = data.map((p) => new Date(`${p.date}T00:00:00`).getTime());
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  let [y0, y1] = [Math.min(...data.map((p) => p.v)), Math.max(...data.map((p) => p.v))];
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const px = (x) => (x1 === x0 ? (L + W - R) / 2 : L + ((x - x0) / (x1 - x0)) * (W - L - R));
  const py = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const fmtV = (v) => `${Math.round(v * 100) / 100}`;
  const tip = (p) => `${fmtDate(p.date)}: ${byKg ? `${p.kg} kg × ${p.reps} ${isTime ? 's' : 'reps'}` : `${p.reps} ${unit}`}`;
  const coords = data.map((p, i) => [px(xs[i]), py(p.v)]);
  const dots = data.map((p, i) => `<g data-action="chart-tip" data-tip="${esc(tip(p))}"><title>${esc(tip(p))}</title>
    <circle class="hit" cx="${coords[i][0]}" cy="${coords[i][1]}" r="12"/><circle class="dot" cx="${coords[i][0]}" cy="${coords[i][1]}" r="4"/></g>`).join('');
  const last = data.at(-1); const [lx, ly] = coords.at(-1);
  const short = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const diff = last.v - data[0].v;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución en ${unit}">
      <line class="grid" x1="${L}" x2="${W - R}" y1="${py(y1)}" y2="${py(y1)}"/>
      <line class="grid" x1="${L}" x2="${W - R}" y1="${py(y0)}" y2="${py(y0)}"/>
      <text x="${L - 6}" y="${py(y1) + 4}" text-anchor="end">${fmtV(y1)}</text>
      <text x="${L - 6}" y="${py(y0) + 4}" text-anchor="end">${fmtV(y0)}</text>
      <text x="${px(x0)}" y="${H - 6}" text-anchor="${data.length > 1 ? 'start' : 'middle'}">${short(data[0].date)}</text>
      ${data.length > 1 ? `<text x="${px(x1)}" y="${H - 6}" text-anchor="end">${short(last.date)}</text>` : ''}
      ${data.length > 1 ? `<polyline class="line" points="${coords.map((c) => c.join(',')).join(' ')}"/>` : ''}
      ${dots}
      <text class="value" x="${lx}" y="${ly - 9}" text-anchor="${data.length > 1 ? 'end' : 'middle'}">${fmtV(last.v)} ${unit}</text>
    </svg>
    <p class="muted small">${data.length} ${data.length === 1 ? 'sesión' : 'sesiones'} · ${byKg ? 'carga más pesada de cada sesión' : `mejor serie en ${unit}`}${data.length > 1 ? ` · ${diff >= 0 ? '+' : ''}${fmtV(diff)} ${unit} desde el inicio` : ''}. Tocá un punto para ver el detalle.</p>`;
}

function presetList(replacing) {
  return PRESETS.map((p) => {
    const count = p.days.reduce((n, d) => n + d.exercises.length, 0);
    return `<section class="card">
      <h3>${esc(p.name)}</h3>
      <p class="muted small">${esc(p.description)}</p>
      <div class="row spread"><span class="small">${p.days.length} ${p.days.length === 1 ? 'día' : 'días'} · ${count} ejercicios</span>
        <button class="btn" data-action="use-preset" data-id="${p.id}" ${replacing ? 'data-confirm="Tocá de nuevo: reemplaza tu rutina"' : ''}>Usar esta</button></div>
    </section>`;
  }).join('');
}

function renderRoutine() {
  if (!dayOf(editDayId)) editDayId = routine.days[0]?.id ?? null;
  const day = dayOf(editDayId);
  const chips = routine.days.map((x) => `<button class="chip" data-action="edit-day" data-id="${x.id}" aria-pressed="${x.id === editDayId}">${esc(x.name)}</button>`).join('')
    + '<button class="chip" data-action="add-day">+ Día</button>';
  const wdOpts = [['', 'Sin día fijo'], ...WEEKDAYS.map((w, i) => [i, w])]
    .map(([v, t]) => `<option value="${v}" ${String(day?.weekday ?? '') === String(v) ? 'selected' : ''}>${t}</option>`).join('');
  const exList = day ? day.exercises.map((ex, i) => exerciseEditor(ex, i, day.exercises.length)).join('') : '';
  $view.innerHTML = `
    <h2>Rutina</h2>
    <div class="chips">${chips}</div>
    ${day ? `<section class="card">
      <div class="grid2">
        <label class="lbl">Nombre del día<input data-r="day" data-key="name" value="${esc(day.name)}"></label>
        <label class="lbl">Se abre automáticamente el<select data-r="day" data-key="weekday">${wdOpts}</select></label>
      </div>
      ${exList || empty('Sin ejercicios todavía.')}
      <button class="btn ghost block" data-action="add-ex">+ Agregar ejercicio</button>
      <button class="btn danger block" data-action="delete-day" data-confirm="Tocá de nuevo para borrar el día">Borrar este día</button>
    </section>` : empty('No hay días. Tocá "+ Día" para crear uno.')}
    <section class="card">
      <label class="lbl">Contexto para Claude (lesiones, objetivos, trabajo). Queda solo en este teléfono y se incluye en el resumen.
        <textarea rows="3" id="routine-context">${esc(routine.context)}</textarea></label>
    </section>
    <p class="muted small">Los cambios se guardan solos. El historial no se pierde al editar la rutina.</p>
    <details class="card">
      <summary><strong>Cambiar de plantilla</strong> <span class="muted small">(tu historial se conserva)</span></summary>
      ${presetList(routine.days.length > 0)}
    </details>`;
}

function exerciseEditor(ex, i, total) {
  const f = (key, label, extra = '') => `<label class="lbl">${label}<input type="number" inputmode="decimal" step="any" data-r="ex" data-id="${ex.id}" data-key="${key}" value="${ex[key]}" ${extra}></label>`;
  const unit = ex.type === 'time' ? 'seg' : 'reps';
  return `<details class="ex" ${openEx.has(ex.id) ? 'open' : ''} data-ex-id="${ex.id}">
    <summary><span class="ex-name">${esc(ex.name)}</span><span class="muted small">${formatTarget(ex)}</span></summary>
    <div class="body">
      <label class="lbl">Ejercicio<input data-r="ex" data-id="${ex.id}" data-key="name" value="${esc(ex.name)}"></label>
      <div class="grid3">
        <label class="lbl">Tipo<select data-r="ex" data-id="${ex.id}" data-key="type">
          <option value="reps" ${ex.type === 'reps' ? 'selected' : ''}>Reps</option>
          <option value="time" ${ex.type === 'time' ? 'selected' : ''}>Tiempo</option></select></label>
        ${f('sets', 'Series', 'min="1" step="1"')}
        ${f('restSec', 'Descanso (s)', 'min="0" step="5"')}
      </div>
      <div class="grid3">
        ${f('min', `Mín ${unit}`, 'min="0" step="1"')}
        ${f('max', `Máx ${unit}`, 'min="0" step="1"')}
        ${f('incKg', 'Subir (kg)', 'min="0"')}
      </div>
      <label class="row small"><input type="checkbox" data-r="ex" data-id="${ex.id}" data-key="perSide" ${ex.perSide ? 'checked' : ''}> Por lado</label>
      <label class="lbl">Indicaciones<textarea rows="2" data-r="ex" data-id="${ex.id}" data-key="notes">${esc(ex.notes)}</textarea></label>
      <div class="row">
        <button class="btn ghost" data-action="move-ex" data-id="${ex.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑ Subir</button>
        <button class="btn ghost" data-action="move-ex" data-id="${ex.id}" data-dir="1" ${i === total - 1 ? 'disabled' : ''}>↓ Bajar</button>
        <button class="btn danger" data-action="delete-ex" data-id="${ex.id}" data-confirm="¿Borrar? Tocá de nuevo">Borrar</button>
      </div>
    </div>
  </details>`;
}

function claudeText() { return toClaudeMarkdown(routine, logs, { today: todayIso(), weeks: claudeWeeks }); }

function renderData() {
  const weekOpts = [4, 8, 12, 26].map((w) => `<option value="${w}" ${w === claudeWeeks ? 'selected' : ''}>${w} semanas</option>`).join('');
  $view.innerHTML = `
    <h2>Datos</h2>
    ${fileCard()}
    <section class="card">
      <h3>Resumen para Claude</h3>
      <p class="muted small">Incluye la rutina, tus sesiones y la sugerencia actual. Copialo y pegalo en una conversación con Claude.</p>
      <div class="row"><select class="inline auto-w" id="claude-weeks" aria-label="Período">${weekOpts}</select>
        <button class="btn" data-action="copy-claude">Copiar</button>
        ${navigator.share ? '<button class="btn ghost" data-action="share-claude">Compartir</button>' : ''}</div>
      <textarea class="out" id="claude-out" readonly aria-label="Resumen para Claude">${esc(claudeText())}</textarea>
    </section>
    <section class="card">
      <h3>Exportar</h3>
      <p class="muted small">${logs.length} sesiones guardadas. Los datos viven solo en este teléfono: descargá un backup cada tanto.</p>
      <div class="row"><button class="btn ghost" data-action="dl-csv">Descargar CSV</button>
        <button class="btn ghost" data-action="dl-json">Descargar backup</button></div>
    </section>
    <section class="card">
      <h3>Importar backup</h3>
      <p class="muted small">Reemplaza la rutina y el historial actuales por los del archivo.</p>
      <input type="file" id="import-file" accept="application/json,.json">
    </section>`;
}

function fileBanner() {
  if (fileSync.state.status !== 'needs-permission') return '';
  return `<section class="card"><div class="row spread"><span class="small">Tus datos se guardan en <strong>${esc(fileSync.state.name)}</strong>. Volvé a darle permiso para seguir guardando.</span>
    <button class="btn" data-action="file-reconnect">Reconectar</button></div></section>`;
}

function fileCard() {
  const st = fileSync.state;
  if (!fileSync.supported) {
    return `<section class="card"><h3>Archivo</h3><p class="muted small">Este navegador no permite guardar directo en un archivo (funciona en Chrome para Android y en Chrome o Edge en la compu). Usá "Descargar backup" e "Importar backup".</p></section>`;
  }
  const body = {
    none: `<p class="muted small">Vinculá un archivo .json: la app guarda ahí cada cambio, como Excalidraw. Ponelo en una carpeta que se sincronice (Drive, por ejemplo) y lo tenés también en la compu.</p>
      <div class="row"><button class="btn" data-action="file-create">Crear archivo</button><button class="btn ghost" data-action="file-open">Abrir archivo</button></div>`,
    'needs-permission': `<p class="small">Vinculado a <strong>${esc(st.name)}</strong>, falta permiso.</p>
      <div class="row"><button class="btn" data-action="file-reconnect">Reconectar</button><button class="btn danger" data-action="file-unlink" data-confirm="Tocá de nuevo para desvincular">Desvincular</button></div>`,
    linked: `<p class="small">Guardando en <strong>${esc(st.name)}</strong>${st.savedAt ? ` · último guardado ${st.savedAt.toLocaleTimeString().slice(0, 5)}` : ''}</p>
      ${st.error ? `<p class="small error-text">No se pudo guardar: ${esc(st.error)}</p>` : ''}
      <div class="row"><button class="btn ghost" data-action="file-open">Abrir otro</button><button class="btn danger" data-action="file-unlink" data-confirm="Tocá de nuevo para desvincular">Desvincular</button></div>`,
  }[st.status];
  return `<section class="card"><h3>Archivo</h3>${body}</section>`;
}

function loadFromFile(data) {
  if (!data) { fileSync.save(store.exportAll()); return; } // empty file: fill it with current data
  store.importAll(data);
  routine = store.getRoutine(); logs = store.getLogs(); editDayId = null;
  if (draft && !dayOf(draft.dayId)) draft = null;
}

async function fileAction(fn, okText) {
  try { await fn(); toast(okText); }
  catch (err) { if (err.name !== 'AbortError') toast(err instanceof SyntaxError ? 'El archivo no es JSON válido.' : err.message); }
  render();
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- actions ----------
function confirmTap(btn) {
  if (!btn.dataset.confirm || btn.dataset.armed) return true;
  btn.dataset.armed = '1'; const original = btn.textContent; btn.textContent = btn.dataset.confirm;
  setTimeout(() => { delete btn.dataset.armed; btn.textContent = original; }, 3000);
  return false;
}

function setDone(ex, i, kgFallback) {
  const s = entryFor(ex).sets[i];
  if (s.kg == null) s.kg = kgFallback;
  if (s.reps == null) s.reps = ex.max;
  s.done = true;
  keepAwake();
  startRest(ex);
}

const actions = {
  'pick-day': (b) => { currentDraft().dayId = b.dataset.id; persistDraft(); render(); },
  'toggle-set': (b) => {
    const ex = findEx(b.dataset.ex); const i = Number(b.dataset.i); const s = entryFor(ex).sets[i];
    if (s.done) s.done = false;
    else setDone(ex, i, num(b.closest('.set').querySelector('[data-field="kg"]').placeholder));
    persistDraft(); render();
  },
  stopwatch: (b) => {
    const ex = findEx(b.dataset.ex); const i = Number(b.dataset.i); const key = `${ex.id}:${i}`;
    const kgPh = num(b.closest('.set').querySelector('[data-field="kg"]').placeholder);
    if (timer?.mode === 'work' && timer.key === key) { timer.onDone(); return; }
    keepAwake();
    startTimer({
      mode: 'work', key, at: Date.now(), label: `En curso · ${ex.name} · serie ${i + 1}`,
      onDone: () => {
        entryFor(ex).sets[i].reps = Math.round((Date.now() - timer.at) / 1000);
        stopTimer(); setDone(ex, i, kgPh); persistDraft(); render();
      },
    });
    render();
  },
  'add-set': (b) => { entryFor(findEx(b.dataset.ex)).sets.push({ kg: null, reps: null, done: false }); persistDraft(); render(); },
  finish: () => {
    const d = currentDraft(); const day = dayOf(d.dayId);
    const exercises = day.exercises.map((ex) => {
      const e = d.entries[ex.id];
      if (!e?.sets.some((s) => s.done)) return null;
      return { exId: ex.id, name: ex.name, type: ex.type, rir: e.rir, sets: e.sets.filter((s) => s.done).map(({ kg, reps }) => ({ kg, reps, done: true })) };
    }).filter(Boolean);
    const note = d.note?.trim().slice(0, 500);
    logs.push({ id: newId('l'), date: d.date, dayId: day.id, dayName: day.name, ...(note && { note }), exercises });
    store.saveLogs(logs); logs = store.getLogs();
    draft = null; store.saveDraft(null); stopTimer(); wakeLock?.release();
    toast('Sesión guardada'); window.scrollTo(0, 0); render();
  },
  discard: () => { draft = null; store.saveDraft(null); stopTimer(); toast('Sesión descartada'); render(); },
  'delete-log': (b) => { logs = logs.filter((l) => l.id !== b.dataset.id); store.saveLogs(logs); toast('Sesión borrada'); render(); },
  'chart-tip': (b) => toast(b.dataset.tip),
  'edit-day': (b) => { editDayId = b.dataset.id; render(); },
  'add-day': () => {
    const day = { id: newId('d'), name: `Día ${routine.days.length + 1}`, weekday: null, exercises: [] };
    routine.days.push(day); editDayId = day.id; saveRoutine(); render();
  },
  'delete-day': () => { routine.days = routine.days.filter((d) => d.id !== editDayId); editDayId = null; saveRoutine(); draft = null; render(); },
  'add-ex': () => {
    const ex = { id: newId('e'), name: 'Nuevo ejercicio', type: 'reps', sets: 3, min: 8, max: 12, restSec: 90, incKg: 2.5, perSide: false, notes: '' };
    dayOf(editDayId).exercises.push(ex); openEx.add(ex.id); saveRoutine(); render();
  },
  'move-ex': (b) => {
    const list = dayOf(editDayId).exercises; const i = list.findIndex((e) => e.id === b.dataset.id); const j = i + Number(b.dataset.dir);
    [list[i], list[j]] = [list[j], list[i]]; saveRoutine(); render();
  },
  'delete-ex': (b) => { const day = dayOf(editDayId); day.exercises = day.exercises.filter((e) => e.id !== b.dataset.id); saveRoutine(); render(); },
  'use-preset': (b) => {
    routine = { ...buildRoutine(b.dataset.id), context: routine.context };
    saveRoutine(); draft = null; store.saveDraft(null); editDayId = null;
    toast('Plantilla cargada'); location.hash = 'train'; render();
  },
  'start-blank': () => { location.hash = 'routine'; actions['add-day'](); },
  'copy-claude': async () => {
    const text = claudeText();
    try { await navigator.clipboard.writeText(text); toast('Copiado. Pegalo en Claude.'); }
    catch { const ta = document.getElementById('claude-out'); ta.focus(); ta.select(); toast('Seleccioné el texto: copialo manualmente'); }
  },
  'share-claude': async () => { try { await navigator.share({ title: 'Registro de entrenamiento', text: claudeText() }); } catch { /* cancelled */ } },
  'file-create': () => fileAction(() => fileSync.createNew(store.exportAll()), 'Archivo creado y vinculado'),
  'file-open': () => fileAction(async () => loadFromFile(await fileSync.openExisting()), 'Archivo abierto'),
  'file-reconnect': () => fileAction(async () => loadFromFile(await fileSync.reconnect()), 'Archivo reconectado'),
  'file-unlink': () => fileAction(() => fileSync.unlink(), 'Archivo desvinculado'),
  'dl-csv': () => download(`rutina-${todayIso()}.csv`, toCsv(logs), 'text/csv'),
  'dl-json': () => download(`rutina-backup-${todayIso()}.json`, JSON.stringify(store.exportAll(), null, 2), 'application/json'),
};

document.addEventListener('click', (ev) => {
  if (!audioCtx && window.AudioContext) audioCtx = new AudioContext();
  const tab = ev.target.closest('.tab');
  if (tab) { location.hash = tab.dataset.view; return; }
  const b = ev.target.closest('[data-action]');
  if (!b || b.disabled || !actions[b.dataset.action]) return;
  if (!confirmTap(b)) return;
  actions[b.dataset.action](b);
});

$view.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.dataset.field && t.dataset.ex) {
    const e = entryFor(findEx(t.dataset.ex));
    if (t.dataset.field === 'rir') e.rir = num(t.value);
    else e.sets[Number(t.dataset.i)][t.dataset.field] = num(t.value);
    persistDraft();
  } else if (t.id === 'routine-context') {
    routine.context = t.value; saveRoutine();
  } else if (t.id === 'draft-note') {
    currentDraft().note = t.value; persistDraft();
  } else if (t.id === 'draft-date' && t.value) {
    currentDraft().date = t.value; persistDraft();
  } else if (t.dataset.r) {
    const target = t.dataset.r === 'day' ? dayOf(editDayId) : findEx(t.dataset.id);
    const key = t.dataset.key;
    let value = t.type === 'checkbox' ? t.checked : t.value;
    if (key === 'weekday') value = num(value);
    else if (t.type === 'number') { if (value === '') return; value = Number(value); }
    target[key] = value;
    saveRoutine();
    if (key === 'name' && t.dataset.r === 'ex') t.closest('details').querySelector('.ex-name').textContent = value;
    if (key === 'name' && t.dataset.r === 'day') document.querySelector(`.chip[data-id="${editDayId}"]`).textContent = value;
  }
});

$view.addEventListener('change', async (ev) => {
  const t = ev.target;
  if (t.id === 'chart-ex') { chartExId = t.value; render(); }
  if (t.id === 'claude-weeks') { claudeWeeks = Number(t.value); document.getElementById('claude-out').value = claudeText(); }
  if (t.dataset.r === 'ex' && ['type', 'sets', 'min', 'max'].includes(t.dataset.key)) render();
  if (t.id === 'import-file' && t.files[0]) {
    try {
      store.importAll(JSON.parse(await t.files[0].text()));
      routine = store.getRoutine(); logs = store.getLogs(); draft = null; store.saveDraft(null); editDayId = null;
      await fileSync.save(store.exportAll());
      toast('Backup importado'); render();
    } catch (err) { toast(err instanceof SyntaxError ? 'El archivo no es JSON válido.' : err.message); }
  }
});

$view.addEventListener('toggle', (ev) => {
  const d = ev.target;
  if (d.matches?.('details.ex')) d.open ? openEx.add(d.dataset.exId) : openEx.delete(d.dataset.exId);
}, true);

let saveId;
store.onChange(() => {
  clearTimeout(saveId);
  saveId = setTimeout(async () => {
    await fileSync.save(store.exportAll());
    if (location.hash === '#data') render();
  }, 400);
});

window.addEventListener('hashchange', render);
navigator.storage?.persist?.();
fileSync.restore().then((data) => { if (data) loadFromFile(data); render(); })
  .catch((err) => { fileSync.state.status = 'needs-permission'; toast(`No se pudo leer el archivo: ${err.message}`); render(); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js');
}
render();
