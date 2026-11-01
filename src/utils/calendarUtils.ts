// Calendar & Date Utilities for Harvest Rentals
// Week starts on Monday. Uses Asia/Kolkata (IST) timezone.

export function getTodayIST(): string {
  // Returns YYYY-MM-DD in India Standard Time
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function parseISTDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatISTDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocaleCode(lang: 'en' | 'kn' | 'hi'): string {
  switch (lang) {
    case 'kn':
      return 'kn-IN';
    case 'hi':
      return 'hi-IN';
    default:
      return 'en-IN';
  }
}

export function formatFriendlyDate(dateStr: string, lang: 'en' | 'kn' | 'hi'): string {
  try {
    const d = parseISTDate(dateStr);
    return new Intl.DateTimeFormat(getLocaleCode(lang), {
      day: 'numeric',
      month: 'short',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatFullDate(dateStr: string, lang: 'en' | 'kn' | 'hi'): string {
  try {
    const d = parseISTDate(dateStr);
    return new Intl.DateTimeFormat(getLocaleCode(lang), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function getMonthName(year: number, monthIndex: number, lang: 'en' | 'kn' | 'hi'): string {
  const d = new Date(year, monthIndex, 1);
  return new Intl.DateTimeFormat(getLocaleCode(lang), {
    month: 'long',
    year: 'numeric',
  }).format(d);
}

// Weekdays starting on Monday (0 = Monday, 6 = Sunday)
export function getLocalizedWeekdays(lang: 'en' | 'kn' | 'hi'): { short: string; full: string }[] {
  const locale = getLocaleCode(lang);
  // 2026-11-02 is a Monday
  const baseMonday = new Date(2026, 10, 2);
  const weekdays: { short: string; full: string }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(baseMonday);
    d.setDate(baseMonday.getDate() + i);
    weekdays.push({
      short: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(d),
      full: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d),
    });
  }
  return weekdays;
}

export interface CalendarDay {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

// Build 35 or 42 grid cells starting on Monday
export function buildMonthDays(year: number, monthIndex: number): CalendarDay[] {
  const todayStr = getTodayIST();
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

  // Convert Sunday (0) to 6, and Monday (1) to 0
  const startDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  const days: CalendarDay[] = [];

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const prevDate = new Date(year, monthIndex - 1, prevMonthLastDay - i);
    const dateStr = formatISTDate(prevDate);
    days.push({
      dateStr,
      dayNumber: prevMonthLastDay - i,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(year, monthIndex, d);
    const dateStr = formatISTDate(curDate);
    days.push({
      dateStr,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
    });
  }

  // Next month leading days to complete full grid
  const remainingCells = 7 - (days.length % 7);
  if (remainingCells < 7) {
    for (let d = 1; d <= remainingCells; d++) {
      const nextDate = new Date(year, monthIndex + 1, d);
      const dateStr = formatISTDate(nextDate);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr,
      });
    }
  }

  return days;
}

// Find nearest free date for a machine in the next 60 days
export function findNearestFreeDate(
  machineId: string,
  busyDates: { machine_id: string; busy_date: string; status?: string }[],
  startDateStr?: string
): string | null {
  const todayStr = getTodayIST();
  const start = startDateStr && startDateStr >= todayStr ? parseISTDate(startDateStr) : parseISTDate(todayStr);

  const machineBlockedSet = new Set(
    busyDates.filter((b) => b.machine_id === machineId).map((b) => b.busy_date)
  );

  // Check up to 60 days forward
  for (let offset = 0; offset < 60; offset++) {
    const checkDate = new Date(start);
    checkDate.setDate(start.getDate() + offset);
    const checkStr = formatISTDate(checkDate);
    if (!machineBlockedSet.has(checkStr)) {
      return checkStr;
    }
  }

  return null;
}

