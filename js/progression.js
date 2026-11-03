// Double progression: hit the top of the range on every set (with reps in reserve) -> add load.
// Every completed set below the bottom of the range -> reduce load. Otherwise hold.

export function suggest(exercise, lastEntry) {
  if (!lastEntry) return { action: 'start', kg: null };

  const sets = lastEntry.sets.filter((s) => s.done && s.reps != null);
  const weights = sets.map((s) => s.kg).filter((kg) => kg != null);
  const topKg = weights.length ? Math.max(...weights) : null;
  // Negative kg = machine assistance (net load). Only positive loads are floored at zero.
  const shift = (delta) => {
    if (topKg == null) return null;
    const next = round(topKg + delta);
    return topKg >= 0 ? Math.max(0, next) : next;
  };

  const rirOk = lastEntry.rir == null || lastEntry.rir >= 1;
  const allAtTop = sets.length >= exercise.sets && sets.every((s) => s.reps >= exercise.max);
  if (allAtTop && rirOk) return { action: 'up', kg: shift(exercise.incKg) };

  if (sets.length > 0 && sets.every((s) => s.reps < exercise.min)) {
    return { action: 'down', kg: shift(-exercise.incKg) };
  }
  return { action: 'hold', kg: topKg };
}

export function findLastEntry(logs, exId) {
  for (let i = logs.length - 1; i >= 0; i--) {
    const entry = logs[i].exercises.find((e) => e.exId === exId);
    if (entry && entry.sets.some((s) => s.done)) return entry;
  }
  return null;
}

const round = (n) => Math.round(n * 100) / 100;
