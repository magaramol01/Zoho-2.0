const padTwo = (value: number) => String(value).padStart(2, "0");

const formatZohoDateTime = (value: Date) => {
  const year = value.getFullYear();
  const month = padTwo(value.getMonth() + 1);
  const day = padTwo(value.getDate());
  const hours = padTwo(value.getHours());
  const minutes = padTwo(value.getMinutes());
  const seconds = padTwo(value.getSeconds());

  const offsetMinutes = -value.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = padTwo(Math.floor(absoluteOffsetMinutes / 60));
  const offsetRemainderMinutes = padTwo(absoluteOffsetMinutes % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}${offsetRemainderMinutes}`;
};

export const toZohoBooleanFlag = (value: boolean) => (value ? "1" : "0");

export const toZohoLogDuration = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.trunc(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainderMinutes = safeMinutes % 60;
  return `${padTwo(hours)}:${padTwo(remainderMinutes)}`;
};

export const toZohoLogDateTime = (value: string) => {
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return formatZohoDateTime(
      new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0),
    );
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return formatZohoDateTime(parsed);
  }

  return value;
};
