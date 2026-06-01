type Listener = (active: boolean) => void;

let _active = false;
const _listeners = new Set<Listener>();

export function startTour(): void {
  _active = true;
  _listeners.forEach(fn => fn(true));
}

export function stopTour(): void {
  _active = false;
  _listeners.forEach(fn => fn(false));
}

export function isTourActive(): boolean {
  return _active;
}

export function subscribeToTour(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
