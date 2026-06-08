// Open-Meteo — no API key required
// Fixed to Imperial College London; update if user location becomes available.
const LAT = 51.4988;
const LON = -0.1749;

// ─── Shared helpers ────────────────────────────────────────────────────────────
export function wmoEmoji(code: number): string {
  if (code === 0)  return '☀️';
  if (code <= 2)   return '🌤';
  if (code === 3)  return '☁️';
  if (code <= 48)  return '🌫';
  if (code <= 55)  return '🌦';
  if (code <= 67)  return '🌧';
  if (code <= 77)  return '❄️';
  if (code <= 82)  return '🌦';
  if (code <= 86)  return '🌨';
  return '⛈';
}

export function wmoCondition(code: number): string {
  if (code === 0)  return 'Clear sky';
  if (code === 1)  return 'Mainly clear';
  if (code === 2)  return 'Partly cloudy';
  if (code === 3)  return 'Overcast';
  if (code <= 48)  return 'Foggy';
  if (code <= 55)  return 'Drizzle';
  if (code <= 67)  return 'Rain';
  if (code <= 77)  return 'Snow';
  if (code <= 82)  return 'Showers';
  if (code <= 86)  return 'Snow showers';
  return 'Thunderstorm';
}

export function outdoorScore(code: number, temp: number, wind: number): number {
  let s = 10;
  if (code >= 95)       s -= 5;
  else if (code >= 80)  s -= 3;
  else if (code >= 60)  s -= 4;
  else if (code >= 51)  s -= 2;
  else if (code >= 45)  s -= 2;
  else if (code === 3)  s -= 1;
  if (temp < 0)         s -= 4;
  else if (temp < 6)    s -= 2;
  else if (temp < 10)   s -= 1;
  else if (temp > 32)   s -= 2;
  else if (temp > 28)   s -= 1;
  if (wind > 40)        s -= 2;
  else if (wind > 25)   s -= 1;
  return Math.max(1, Math.min(10, s));
}

// ─── Slot-weather (plan wizard) ────────────────────────────────────────────────
export interface SlotWeather { emoji: string; temp: number; }

const SLOT_HOURS: Record<string, { d: number; h: number }> = {
  now:           { d: 0, h: -1 },
  afternoon:     { d: 0, h: 13 },
  late:          { d: 0, h: 15 },
  evening:       { d: 0, h: 18 },
  tmr_morning:   { d: 1, h:  9 },
  tmr_afternoon: { d: 1, h: 13 },
  tmr_evening:   { d: 1, h: 17 },
  thu:           { d: 2, h: 12 },
  fri:           { d: 3, h: 12 },
  sat:           { d: 4, h: 12 },
  sun:           { d: 5, h: 12 },
};

export async function fetchForecast(): Promise<Map<string, SlotWeather>> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&hourly=temperature_2m,weathercode` +
    `&timezone=Europe%2FLondon&forecast_days=7`;

  const res = await fetch(url);
  if (!res.ok) { const e = new Error(`Weather API ${res.status}`); console.error('weather fetch error:', e.message); throw e; }
  const data = await res.json();

  const times: string[] = data.hourly.time;
  const temps: number[] = data.hourly.temperature_2m;
  const codes: number[] = data.hourly.weathercode;

  const hourly = new Map<string, SlotWeather>();
  for (let i = 0; i < times.length; i++) {
    hourly.set(times[i], { emoji: wmoEmoji(codes[i]), temp: Math.round(temps[i]) });
  }

  const now = new Date();
  const result = new Map<string, SlotWeather>();
  for (const [slotId, { d, h }] of Object.entries(SLOT_HOURS)) {
    const hour = h === -1 ? now.getHours() : h;
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const key = `${date.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00`;
    const w = hourly.get(key);
    if (w) result.set(slotId, w);
  }
  return result;
}

// ─── Full forecast (home screen) ───────────────────────────────────────────────
export interface CurrentWeather {
  temp: number; feelsLike: number; humidity: number;
  windspeed: number; code: number; emoji: string;
  condition: string; score: number;
}
export interface HourlyItem {
  hour: string; temp: number; emoji: string; score: number;
  hourNum: number; dayOffset: number;
}
export interface DailyItem {
  day: string; date: string; tempMax: number; tempMin: number;
  emoji: string; condition: string; score: number;
}
export interface FullForecast {
  current: CurrentWeather;
  hourly: HourlyItem[];   // next 12 hours from now
  daily: DailyItem[];     // 7 days
}

export async function fetchFullForecast(): Promise<FullForecast> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&current_weather=true` +
    `&hourly=temperature_2m,apparent_temperature,relativehumidity_2m,weathercode,windspeed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode,windspeed_10m_max` +
    `&timezone=Europe%2FLondon&forecast_days=7`;

  const res = await fetch(url);
  if (!res.ok) { const e = new Error(`Weather API ${res.status}`); console.error('weather fetch error:', e.message); throw e; }
  const data = await res.json();

  const cw = data.current_weather;
  const now = new Date();
  const curHour = now.getHours();
  const todayStr = now.toISOString().slice(0, 10);
  const curKey   = `${todayStr}T${String(curHour).padStart(2, '0')}:00`;

  // Find current-hour index in hourly arrays
  const hTimes: string[] = data.hourly.time;
  const hTemps: number[] = data.hourly.temperature_2m;
  const hFeels: number[] = data.hourly.apparent_temperature;
  const hHumid: number[] = data.hourly.relativehumidity_2m;
  const hCodes: number[] = data.hourly.weathercode;
  const hWind:  number[] = data.hourly.windspeed_10m;

  const curIdx = hTimes.findIndex(t => t === curKey);

  // Build current conditions
  const curCode  = curIdx >= 0 ? hCodes[curIdx] : cw.weathercode;
  const curTemp  = curIdx >= 0 ? Math.round(hTemps[curIdx]) : Math.round(cw.temperature);
  const curFeel  = curIdx >= 0 ? Math.round(hFeels[curIdx]) : curTemp - 2;
  const curHumid = curIdx >= 0 ? hHumid[curIdx] : 60;
  const curWind  = Math.round(cw.windspeed);

  const current: CurrentWeather = {
    temp: curTemp, feelsLike: curFeel, humidity: curHumid,
    windspeed: curWind, code: curCode,
    emoji: wmoEmoji(curCode), condition: wmoCondition(curCode),
    score: outdoorScore(curCode, curTemp, curWind),
  };

  // Next 12 hours (from current hour onwards)
  const startIdx = curIdx >= 0 ? curIdx : 0;
  const hourly: HourlyItem[] = [];
  for (let i = startIdx; i < Math.min(startIdx + 12, hTimes.length); i++) {
    const t = new Date(hTimes[i]);
    const h = t.getHours();
    const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
    const temp  = Math.round(hTemps[i]);
    const code  = hCodes[i];
    const wind  = hWind[i];
    const dayOffset = hTimes[i].startsWith(todayStr) ? 0 : 1;
    hourly.push({ hour: label, temp, emoji: wmoEmoji(code), score: outdoorScore(code, temp, wind), hourNum: h, dayOffset });
  }

  // 7-day daily
  const dTimes:   string[] = data.daily.time;
  const dMax:     number[] = data.daily.temperature_2m_max;
  const dMin:     number[] = data.daily.temperature_2m_min;
  const dCodes:   number[] = data.daily.weathercode;
  const dWind:    number[] = data.daily.windspeed_10m_max;

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daily: DailyItem[] = dTimes.map((dateStr, i) => {
    const d    = new Date(dateStr + 'T12:00:00');
    const isToday = dateStr === todayStr;
    const day  = isToday ? 'Today' : DAY_NAMES[d.getDay()];
    const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const code = dCodes[i];
    const max  = Math.round(dMax[i]);
    const min  = Math.round(dMin[i]);
    const wind = Math.round(dWind[i]);
    return {
      day, date, tempMax: max, tempMin: min,
      emoji: wmoEmoji(code), condition: wmoCondition(code),
      score: outdoorScore(code, max, wind),
    };
  });

  return { current, hourly, daily };
}

// ─── Per-slot hourly scores for plan wizard ────────────────────────────────────
// Returns a map keyed `${dayOffset}:${hour}` → { emoji, score }
// dayOffset 0 = today … up to 13 (two weeks)
export async function fetchHourlyScores(): Promise<Map<string, { emoji: string; score: number }>> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&hourly=temperature_2m,weathercode,windspeed_10m` +
    `&timezone=Europe%2FLondon&forecast_days=14`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather ${res.status}`);
  const data = await res.json();
  const times: string[] = data.hourly.time;
  const temps: number[] = data.hourly.temperature_2m;
  const codes: number[] = data.hourly.weathercode;
  const winds: number[] = data.hourly.windspeed_10m;
  const now = new Date();
  const dateMap: Record<string, number> = {};
  for (let d = 0; d < 14; d++) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + d);
    dateMap[dt.toISOString().slice(0, 10)] = d;
  }
  const result = new Map<string, { emoji: string; score: number; temp: number }>();
  for (let i = 0; i < times.length; i++) {
    const dateStr = times[i].slice(0, 10);
    const hour = parseInt(times[i].slice(11, 13), 10);
    const d = dateMap[dateStr];
    if (d !== undefined) {
      result.set(`${d}:${hour}`, {
        emoji: wmoEmoji(codes[i]),
        score: outdoorScore(codes[i], Math.round(temps[i]), winds[i]),
        temp: Math.round(temps[i]),
      });
    }
  }
  return result;
}
