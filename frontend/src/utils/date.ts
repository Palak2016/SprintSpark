
const DATE_LOCALE = 'en-IN';
const DATE_TIME_ZONE = 'Asia/Kolkata';

export const parseIndianDateTime = (
  value?: string | null
): Date | null => {
  if (typeof value !== 'string' || !value.trim()) return null;

  const normalizedValue = value.trim();
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  const dateTimePattern =
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i;

  let date: Date;
  if (dateOnlyPattern.test(normalizedValue)) {
    const utcDate = new Date(`${normalizedValue}T00:00:00.000Z`);
    if (
      Number.isNaN(utcDate.getTime()) ||
      utcDate.toISOString().slice(0, 10) !== normalizedValue
    ) {
      return null;
    }

    date = new Date(`${normalizedValue}T12:00:00+05:30`);
  } else if (dateTimePattern.test(normalizedValue)) {
    const normalizedDateTime = normalizedValue.replace(' ', 'T');
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedDateTime);
    // Legacy naive API timestamps are UTC values from UTC-session database columns.
    date = new Date(
      hasTimezone ? normalizedDateTime : `${normalizedDateTime}Z`
    );
  } else {
    return null;
  }

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
  value?: string | null,
  includeSeconds = false
): string => {
  const date = parseIndianDateTime(value);

  if (!date) return '—';

  return date.toLocaleTimeString(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
    timeZone: DATE_TIME_ZONE,
  });
};
