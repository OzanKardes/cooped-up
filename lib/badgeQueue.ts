import type { BadgeDef } from '../services/badges';

type Listener = (badge: BadgeDef) => void;
const listeners = new Set<Listener>();

export function notifyBadgeUnlocked(badge: BadgeDef): void {
  listeners.forEach(l => l(badge));
}

export function onBadgeUnlocked(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
