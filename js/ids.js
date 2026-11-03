// Ids are unique across builds and sessions, so history never attaches to an unrelated exercise.
export const newId = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
