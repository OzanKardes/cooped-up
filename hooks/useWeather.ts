import { useState, useEffect } from 'react';
import { fetchForecast, type SlotWeather } from '../services/weather';

export function useWeather() {
  const [forecast, setForecast] = useState<Map<string, SlotWeather>>(new Map());
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetchForecast()
      .then(setForecast)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Returns real weather for a slot, or null if fetch is still loading / failed
  const slotWeather = (slotId: string): SlotWeather | null =>
    forecast.get(slotId) ?? null;

  return { slotWeather, forecastLoading: loading };
}
