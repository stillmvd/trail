import { useSyncExternalStore } from "react";

export function createLocalStore<T extends string>(key: string, fallback: T, migrateLegacy = true) {
  // Одноразовый перенос ключей rings.* → trail.* после переименования приложения.
  const legacyKey = migrateLegacy && key.startsWith("trail.") ? `rings.${key.slice(6)}` : null;
  if (legacyKey && localStorage.getItem(key) === null) {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem(legacyKey);
    }
  }
  let listeners: Array<() => void> = [];
  const get = () => (localStorage.getItem(key) as T | null) ?? fallback;
  const set = (value: T) => {
    localStorage.setItem(key, value);
    listeners.forEach((l) => l());
  };
  const subscribe = (listener: () => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  };
  const use = () => useSyncExternalStore(subscribe, get);
  return { use, set, get };
}

export function createMemoryStore<T>(initial: T) {
  let value = initial;
  let listeners: Array<() => void> = [];
  const get = () => value;
  const set = (next: T) => {
    value = next;
    listeners.forEach((l) => l());
  };
  const subscribe = (listener: () => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  };
  const use = () => useSyncExternalStore(subscribe, get);
  return { use, set, get };
}
