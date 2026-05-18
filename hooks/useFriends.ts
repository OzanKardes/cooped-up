import { useState, useEffect, useCallback } from 'react';
import { getFriends } from '../services/friends';
import { useAuth } from './useAuth';
import type { User } from '../types';

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFriends(user.id);
      setFriends([...data].sort((a, b) => ((b as any).plan_count ?? 0) - ((a as any).plan_count ?? 0)));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { refetch(); }, [refetch]);
  return { friends, loading, error, refetch };
}
