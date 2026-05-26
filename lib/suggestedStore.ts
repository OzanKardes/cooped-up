export type BookmarkedPlan = {
  id: string;
  title: string;
  location: string;
  time: string;
};

const _plans = new Map<string, BookmarkedPlan>();
const _listeners = new Set<() => void>();

export function bookmarkPlan(plan: BookmarkedPlan) {
  _plans.set(plan.id, plan);
  _listeners.forEach(fn => fn());
}

export function unbookmarkPlan(id: string) {
  _plans.delete(id);
  _listeners.forEach(fn => fn());
}

export function isBookmarked(id: string) {
  return _plans.has(id);
}

export function getBookmarkedPlans(): BookmarkedPlan[] {
  return Array.from(_plans.values());
}

export function subscribe(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
