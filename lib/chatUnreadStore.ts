type Listener = (count: number) => void;
const listeners = new Set<Listener>();

export function notifyChatUnreadCount(count: number): void {
  listeners.forEach(l => l(count));
}

export function onChatUnreadCount(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
