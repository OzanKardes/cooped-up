let _dark = false;
const _listeners = new Set<() => void>();

export function setDark(on: boolean) {
  _dark = on;
  _listeners.forEach(fn => fn());
}

export function isDark(): boolean {
  return _dark;
}

export function subscribe(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

// Dark mode colour palette
export const DarkTheme = {
  bg: '#102040',           // screen background — lighter than #001845 buttons
  surface: '#1A2F50',      // cards, panels
  surfaceAlt: '#1E3560',   // alternate surface (e.g. badge tiles)
  border: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.55)',
};
