export const CENTRAL_TIMEZONE = "America/Chicago";

const DEFAULT_LOCALE = "en-US";

type DateInput = Date | string | number;

export function formatCentralDateTime(
  date: DateInput,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Date(date).toLocaleString(DEFAULT_LOCALE, {
    timeZone: CENTRAL_TIMEZONE,
    year: "2-digit",
    ...options,
  });
}

export function formatCentralDate(
  date: DateInput,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Date(date).toLocaleDateString(DEFAULT_LOCALE, {
    timeZone: CENTRAL_TIMEZONE,
    year: "2-digit",
    ...options,
  });
}

export function formatCentralTime(
  date: DateInput,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Date(date).toLocaleTimeString(DEFAULT_LOCALE, {
    timeZone: CENTRAL_TIMEZONE,
    ...options,
  });
}
