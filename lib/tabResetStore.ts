const resets: Record<number, (() => void) | null> = {};

export function registerTabReset(index: number, fn: () => void): () => void {
  resets[index] = fn;
  return () => { resets[index] = null; };
}

export function triggerTabReset(index: number): void {
  resets[index]?.();
}
