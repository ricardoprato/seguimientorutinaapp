import { newId } from './ids.js';

// Ready-made routines so a new user can start without configuring every exercise.
// weekday: 0 = Sunday ... 6 = Saturday. type 'reps': min/max reps; type 'time': min/max seconds.

const ex = (name, sets, min, max, restSec, incKg, extra = {}) => ({
  name, type: 'reps', sets, min, max, restSec, incKg, perSide: false, notes: '', ...extra,
});
const timed = (name, sets, min, max, restSec, incKg, extra = {}) => ex(name, sets, min, max, restSec, incKg, { type: 'time', ...extra });

const MOBILITY = [
  timed('Couch stretch', 2, 60, 90, 15, 0, { perSide: true, notes: 'Flexores de cadera: compensa estar sentado.' }),
  ex('90/90 de cadera', 2, 5, 8, 15, 0, { perSide: true }),
  ex('Knee-to-wall (tobillo)', 2, 10, 15, 15, 0, { perSide: true, notes: 'Podés anotar en kg los cm a la pared para seguir el progreso.' }),
  timed('Sentadilla profunda con apoyo', 3, 45, 60, 30, 0),
  ex('Extensión torácica en foam roller', 2, 10, 12, 15, 0),
  ex('Open book', 2, 8, 10, 15, 0, { perSide: true }),
  timed('Colgado pasivo de barra', 3, 20, 40, 45, 0, { notes: 'Estira dorsales y ayuda a levantar los brazos.' }),
  ex('CARs de hombro', 2, 5, 5, 15, 0, { perSide: true, notes: 'Lento y controlado, sin forzar rangos molestos.' }),
];

export const PRESETS = [
  {
    id: 'fullbody3',
    name: 'Full Body 3 días',
    description: 'Cuerpo completo lunes, miércoles y viernes. Ideal para empezar o con poco tiempo.',
    days: [
      { name: 'Full Body A', weekday: 1, exercises: [
        ex('Sentadilla goblet', 3, 8, 12, 120, 2),
        ex('Press banca con mancuernas', 3, 8, 12, 90, 2),
        ex('Remo con mancuerna', 3, 10, 12, 90, 2, { perSide: true }),
        ex('Peso muerto rumano con mancuernas', 3, 10, 12, 90, 2),
        timed('Plancha frontal', 3, 30, 60, 45, 0),
      ] },
      { name: 'Full Body B', weekday: 3, exercises: [
        ex('Prensa de piernas', 3, 10, 15, 120, 10),
        ex('Press militar sentado con mancuernas', 3, 8, 12, 90, 1),
        ex('Jalón al pecho', 3, 10, 12, 90, 5),
        ex('Hip thrust', 3, 10, 12, 90, 5),
        ex('Dead bug', 3, 8, 12, 45, 0, { perSide: true }),
      ] },
      { name: 'Full Body C', weekday: 5, exercises: [
        ex('Zancada caminando', 3, 10, 12, 90, 2, { perSide: true }),
        ex('Flexiones', 3, 8, 15, 60, 0),
        ex('Remo sentado en polea', 3, 10, 12, 90, 5),
        ex('Curl femoral', 3, 10, 15, 60, 5),
        timed('Farmer carry', 3, 30, 45, 60, 2, { notes: 'Kg por mano.' }),
      ] },
    ],
  },
  {
    id: 'upperlower4',
    name: 'Torso / Pierna 4 días',
    description: 'Dos días de torso y dos de pierna. Buen equilibrio entre fuerza e hipertrofia.',
    days: [
      { name: 'Torso A', weekday: 1, exercises: [
        ex('Press banca con barra', 3, 6, 8, 150, 2.5),
        ex('Remo con barra', 3, 6, 8, 150, 2.5),
        ex('Press militar con mancuernas', 3, 8, 10, 90, 1),
        ex('Jalón al pecho', 3, 10, 12, 90, 5),
        ex('Elevaciones laterales', 3, 12, 15, 60, 1),
        ex('Curl de bíceps', 2, 10, 12, 60, 1),
        ex('Tríceps en polea', 2, 10, 12, 60, 2.5),
      ] },
      { name: 'Pierna A', weekday: 2, exercises: [
        ex('Sentadilla trasera', 3, 5, 8, 180, 2.5),
        ex('Peso muerto rumano', 3, 8, 10, 120, 2.5),
        ex('Prensa de piernas', 3, 10, 12, 90, 10),
        ex('Curl femoral', 3, 10, 12, 60, 5),
        ex('Gemelos de pie', 4, 12, 15, 60, 5),
      ] },
      { name: 'Torso B', weekday: 4, exercises: [
        ex('Press inclinado con mancuernas', 3, 8, 10, 120, 2),
        ex('Dominadas', 3, 6, 10, 120, 2.5, { notes: 'Con lastre: kg en positivo. Asistida (máquina o banda): kg de ayuda en negativo, ej. -20.' }),
        ex('Remo sentado en polea', 3, 10, 12, 90, 5),
        ex('Cruce de poleas', 3, 12, 15, 60, 2.5),
        ex('Face pull', 3, 15, 20, 60, 2.5),
        ex('Curl martillo', 2, 10, 12, 60, 1),
      ] },
      { name: 'Pierna B', weekday: 5, exercises: [
        ex('Peso muerto', 3, 4, 6, 180, 5),
        ex('Sentadilla búlgara', 3, 8, 10, 90, 2, { perSide: true }),
        ex('Hip thrust', 3, 8, 12, 90, 5),
        ex('Extensión de cuádriceps', 3, 12, 15, 60, 5),
        ex('Rueda abdominal', 3, 8, 12, 60, 0),
      ] },
    ],
  },
  {
    id: 'ppl6',
    name: 'Push / Pull / Legs 6 días',
    description: 'Empuje, tirón y pierna dos veces por semana, con trabajo funcional y un día de movilidad.',
    days: [
      { name: 'Empuje A', weekday: 1, exercises: [
        ex('Press inclinado con mancuernas', 3, 6, 8, 150, 2, { notes: 'Kg por mancuerna.' }),
        ex('Press landmine unilateral de pie', 3, 8, 10, 90, 2.5, { perSide: true, notes: 'Alternativa al press militar, más amigable con el hombro.' }),
        ex('Press plano en multipower', 3, 10, 12, 90, 5),
        ex('Cruce de poleas', 3, 12, 15, 60, 2.5),
        ex('Elevaciones laterales en polea baja', 4, 12, 15, 60, 1, { perSide: true }),
        ex('Tríceps en polea con cuerda', 3, 10, 12, 60, 2.5),
      ] },
      { name: 'Tirón A', weekday: 2, exercises: [
        ex('Remo Pendlay', 3, 6, 8, 150, 5),
        ex('Dominadas', 3, 6, 10, 120, 2.5, { notes: 'Con lastre: kg en positivo. Asistida (máquina o banda): kg de ayuda en negativo, ej. -20.' }),
        ex('Remo con mancuerna', 3, 8, 10, 90, 2, { perSide: true }),
        ex('Face pull', 3, 15, 20, 60, 2.5, { notes: 'Carga liviana, codos altos.' }),
        ex('Curl inclinado con mancuernas', 3, 10, 12, 60, 1),
        timed('Pallof press', 3, 30, 45, 60, 2.5, { perSide: true }),
      ] },
      { name: 'Pierna A', weekday: 3, exercises: [
        ex('Sentadilla con talones elevados', 3, 6, 8, 180, 5, { notes: 'Útil si te falta movilidad de tobillo.' }),
        ex('Sentadilla búlgara', 3, 8, 10, 90, 2, { perSide: true }),
        ex('Extensión de cuádriceps', 3, 12, 15, 60, 5),
        ex('Gemelos de pie', 4, 12, 15, 60, 5, { notes: 'Pausa de 2 s abajo, rango completo.' }),
        ex('Rueda abdominal', 3, 8, 12, 60, 0),
      ] },
      { name: 'Empuje B', weekday: 4, exercises: [
        ex('Press plano con mancuernas', 3, 8, 10, 120, 2),
        ex('Flexiones lastradas o en déficit', 3, 10, 15, 90, 2.5),
        ex('Peck deck', 3, 12, 15, 60, 5),
        ex('Elevaciones laterales', 3, 15, 20, 60, 1),
        ex('Press francés con barra Z', 3, 10, 12, 60, 2.5),
        timed('Farmer carry', 3, 30, 45, 90, 2, { notes: 'Kg por mano.' }),
      ] },
      { name: 'Tirón B', weekday: 5, exercises: [
        ex('Jalón agarre neutro', 3, 10, 12, 90, 5),
        ex('Remo sentado en polea', 3, 10, 12, 90, 5),
        ex('Pullover en polea con cuerda', 3, 12, 15, 60, 2.5),
        ex('Pájaros / reverse fly', 3, 15, 20, 60, 1),
        ex('Curl martillo', 3, 10, 12, 60, 1),
        timed('Suitcase carry', 3, 30, 45, 60, 2, { perSide: true }),
      ] },
      { name: 'Pierna B', weekday: 6, exercises: [
        ex('Peso muerto rumano', 3, 6, 8, 150, 5),
        ex('Hip thrust', 3, 8, 12, 120, 5),
        ex('Step-up', 3, 10, 12, 90, 2, { perSide: true }),
        ex('Curl femoral', 3, 10, 12, 60, 5),
        ex('Gemelo sentado (sóleo)', 3, 15, 20, 60, 5),
        timed('Plancha lateral', 3, 30, 45, 45, 0, { perSide: true }),
      ] },
      { name: 'Movilidad', weekday: 0, exercises: MOBILITY },
    ],
  },
  {
    id: 'mobility',
    name: 'Movilidad para oficina',
    description: 'Una sesión de 20 a 30 minutos de cadera, tobillo, columna y hombros. Sumala a cualquier plan.',
    days: [{ name: 'Movilidad', weekday: null, exercises: MOBILITY }],
  },
];

export const emptyRoutine = () => ({ version: 1, context: '', days: [] });

export function buildRoutine(presetId) {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Plantilla desconocida: ${presetId}`);
  return {
    version: 1,
    context: '',
    days: preset.days.map((d) => ({
      id: newId('d'), name: d.name, weekday: d.weekday,
      exercises: d.exercises.map((e) => ({ ...e, id: newId('e') })),
    })),
  };
}
