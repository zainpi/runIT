// Keep names and prose as text; React and parameterized SQL handle output contexts.
export const hasControlCharacters = (value: string) =>
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);

export function isHttpsUrl(value: string) {
  if (value.length > 2000 || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isCalendarDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
