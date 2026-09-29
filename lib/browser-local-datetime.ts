const LOCAL_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Convert a browser `datetime-local` value into an absolute UTC Date.
 *
 * `Date#getTimezoneOffset()` follows the UTC - local convention. For WIB it
 * returns -420, so 16:40 local becomes 09:40 UTC.
 */
export function parseBrowserLocalDateTime(
  value: string,
  timezoneOffsetMinutes: number,
): Date {
  const match = LOCAL_DATETIME_PATTERN.exec(value);
  if (!match) throw new RangeError('Invalid local datetime');
  if (!Number.isInteger(timezoneOffsetMinutes) || Math.abs(timezoneOffsetMinutes) > 840) {
    throw new RangeError('Invalid timezone offset');
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const validationDate = new Date(wallClockUtc);
  if (
    validationDate.getUTCFullYear() !== year
    || validationDate.getUTCMonth() !== month - 1
    || validationDate.getUTCDate() !== day
    || validationDate.getUTCHours() !== hour
    || validationDate.getUTCMinutes() !== minute
    || validationDate.getUTCSeconds() !== second
  ) {
    throw new RangeError('Invalid local datetime');
  }

  return new Date(wallClockUtc + timezoneOffsetMinutes * 60_000);
}
