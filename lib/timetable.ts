export const DE_TIMETABLE = [
  // Monday 01 June
  { id: 't1', title: 'DSDE DE1 Personal Tutorial', location: 'Online/TBC', day: 1, startHour: 10, endHour: 11 },

  // Tuesday 02 June
  { id: 't2', title: 'DESE40006 – Electronics 1', location: 'RODH 409', day: 2, startHour: 10, endHour: 11 },
  { id: 't3', title: 'DESE40004 – Human Centred Design Engineering', location: 'DBDE 301', day: 2, startHour: 13, endHour: 15 },

  // Wednesday 03 June
  { id: 't4', title: 'DESE40009 – Data Science', location: 'RODH 409', day: 3, startHour: 10, endHour: 11 },

  // Thursday 04 June
  { id: 't5', title: 'DESE40006 – Electronics 1', location: 'RODH 409', day: 4, startHour: 10, endHour: 11 },
  { id: 't6', title: 'DESE40006 – Electronics 1', location: 'ACEX 151 - Ground Floor Bench Area', day: 4, startHour: 13, endHour: 16 },
  { id: 't7', title: 'DE Seminars Series Summer', location: 'Dyson Building', day: 4, startHour: 15, endHour: 16 },

  // Friday 05 June
  { id: 't8', title: 'DESE40009 – Data Science', location: 'DBDE 301', day: 5, startHour: 10, endHour: 11 },
  { id: 't9', title: 'DESE40004 – Human Centred Design Engineering', location: 'ACEX 151 - Ground Floor Bench Area', day: 5, startHour: 13, endHour: 15 },
];

export type TimetableEvent = typeof DE_TIMETABLE[0];

// Returns timetable events that overlap with the given plan slot.
// dayOffset is relative to today; startHour/endHour define the slot's time window.
const SLOT_MAP: Record<string, { dayOffset: number; startHour: number; endHour: number }> = {
  now:           { dayOffset: 0, startHour: -1, endHour: -1 }, // resolved at call time
  afternoon:     { dayOffset: 0, startHour: 13, endHour: 15 },
  late:          { dayOffset: 0, startHour: 15, endHour: 18 },
  evening:       { dayOffset: 0, startHour: 18, endHour: 22 },
  tmr_morning:   { dayOffset: 1, startHour:  9, endHour: 13 },
  tmr_afternoon: { dayOffset: 1, startHour: 13, endHour: 17 },
  tmr_evening:   { dayOffset: 1, startHour: 17, endHour: 22 },
  thu:           { dayOffset: 2, startHour:  0, endHour: 24 },
  fri:           { dayOffset: 3, startHour:  0, endHour: 24 },
  sat:           { dayOffset: 4, startHour:  0, endHour: 24 },
  sun:           { dayOffset: 5, startHour:  0, endHour: 24 },
};

export function getSlotConflicts(slotId: string): TimetableEvent[] {
  const info = SLOT_MAP[slotId];
  if (!info) return [];

  const today = new Date();
  let { startHour, endHour } = info;

  if (slotId === 'now') {
    startHour = today.getHours();
    endHour   = startHour + 1;
  }

  const targetDay = (today.getDay() + info.dayOffset) % 7;

  return DE_TIMETABLE.filter(
    e => e.day === targetDay && e.startHour < endHour && e.endHour > startHour,
  );
}
