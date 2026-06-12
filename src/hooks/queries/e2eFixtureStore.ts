import { E2E_CALENDAR, E2E_SCHEDULE_ROWS } from "@/lib/e2eFixtures";
import type { SavedCalendarInsert } from "./shared";

export type E2ECalendar = typeof E2E_CALENDAR;
export type E2EScheduleRow = (typeof E2E_SCHEDULE_ROWS)[number];

let e2eCalendars: E2ECalendar[] = [];
let e2eScheduleRows: E2EScheduleRow[] = [];

const E2E_CALENDARS_KEY = "ss:e2e-calendars";
const E2E_SCHEDULE_ROWS_KEY = "ss:e2e-schedule-rows";

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function readPersistedE2E<T>(key: string): T[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : null;
  } catch {
    return null;
  }
}

function writePersistedE2E<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* best effort */
  }
}

function seedE2EStores() {
  if (e2eCalendars.length === 0) {
    const persistedCalendars = readPersistedE2E<E2ECalendar>(E2E_CALENDARS_KEY);
    e2eCalendars = persistedCalendars && persistedCalendars.length > 0 ? persistedCalendars : [clone(E2E_CALENDAR)];
  }
  if (e2eScheduleRows.length === 0) {
    const persistedRows = readPersistedE2E<E2EScheduleRow>(E2E_SCHEDULE_ROWS_KEY);
    e2eScheduleRows = persistedRows && persistedRows.length > 0 ? persistedRows : clone(E2E_SCHEDULE_ROWS);
  }
  writePersistedE2E(E2E_CALENDARS_KEY, e2eCalendars);
  writePersistedE2E(E2E_SCHEDULE_ROWS_KEY, e2eScheduleRows);
}

export function getE2ECalendars() {
  seedE2EStores();
  return clone(e2eCalendars);
}

export function getE2EScheduleRows() {
  seedE2EStores();
  return clone(e2eScheduleRows);
}

export function findE2ECalendar(id: string) {
  seedE2EStores();
  const calendar = e2eCalendars.find((item) => item.id === id);
  if (!calendar && id === E2E_CALENDAR.id) {
    return clone(E2E_CALENDAR);
  }
  return calendar ? clone(calendar) : null;
}

export function updateE2ECalendar(id: string, patch: Partial<E2ECalendar>) {
  seedE2EStores();
  e2eCalendars = e2eCalendars.map((calendar) => (calendar.id === id ? { ...calendar, ...patch } : calendar));
  writePersistedE2E(E2E_CALENDARS_KEY, e2eCalendars);
}

export function deleteE2ECalendar(id: string) {
  seedE2EStores();
  e2eCalendars = e2eCalendars.filter((calendar) => calendar.id !== id);
  e2eScheduleRows = e2eScheduleRows.filter((row) => row.calendar_id !== id);
  writePersistedE2E(E2E_CALENDARS_KEY, e2eCalendars);
  writePersistedE2E(E2E_SCHEDULE_ROWS_KEY, e2eScheduleRows);
}

export function insertE2ECalendar(calendar: SavedCalendarInsert | Partial<E2ECalendar>) {
  seedE2EStores();
  const posts = Array.isArray((calendar as { posts?: unknown }).posts)
    ? clone((calendar as { posts?: unknown[] }).posts)
    : clone(E2E_CALENDAR.posts);
  const next = {
    ...clone(E2E_CALENDAR),
    ...calendar,
    posts,
    id: calendar.id || `e2e-calendar-${Date.now()}`,
  } as E2ECalendar;
  e2eCalendars = [next, ...e2eCalendars.filter((existing) => existing.id !== next.id)];
  writePersistedE2E(E2E_CALENDARS_KEY, e2eCalendars);
  return next;
}

export function updateE2EScheduleRow(id: string, patch: Record<string, unknown>) {
  seedE2EStores();
  e2eScheduleRows = e2eScheduleRows.map((row) => (row.id === id ? { ...row, ...patch } : row));
  writePersistedE2E(E2E_SCHEDULE_ROWS_KEY, e2eScheduleRows);
}
