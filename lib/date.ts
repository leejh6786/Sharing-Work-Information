const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function normalizeDate(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const match = text.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) return text;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

export function dayOfWeek(date: string): string {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const value = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return WEEKDAYS[value.getDay()];
}

export function koreanDate(date: string): string {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  return `${match[1]}. ${Number(match[2])}. ${Number(match[3])}.`;
}
