type Listener = (count: number) => void;
const listeners = new Set<Listener>();

export function notifyPlanInviteCount(count: number): void {
  listeners.forEach(l => l(count));
}

export function onPlanInviteCount(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
