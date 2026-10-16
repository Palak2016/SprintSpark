
const DATE_LOCALE = 'en-IN';
const DATE_TIME_ZONE = 'Asia/Kolkata';

export const parseIndianDateTime = (
  value?: string | null
): Date | null => {
  if (!value) return null;

  // Date-only values should not shift to the previous day.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+05:30`)
    : /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
      ? new Date(`${value.replace(' ', 'T')}Z`)
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

export const formatIndianDate = (
  value?: string | null
): string => {
  const date = parseIndianDateTime(value);

  if (!date) return '—';

  return date.toLocaleDateString(DATE_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: DATE_TIME_ZONE,
  });
};

export const formatIndianDateTime = (
  value?: string | null
): string => {
  const date = parseIndianDateTime(value);

  if (!date) return '—';

  return date.toLocaleString(DATE_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: DATE_TIME_ZONE,
  });
};

export const formatIndianTime = (
  value?: string | null
): string => {
  const date = parseIndianDateTime(value);

  if (!date) return '—';

  return date.toLocaleTimeString(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: DATE_TIME_ZONE,
  });
};
