// Date helpers. All display uses Bangkok time; all math uses epoch ms.

const MIN = 60_000;
const HOUR = 60 * MIN;

export const ms = (iso: string): number => Date.parse(iso);

export function addMinutes(iso: string, minutes: number): string {
  return new Date(ms(iso) + minutes * MIN).toISOString();
}

export function addHours(iso: string, hours: number): string {
  return new Date(ms(iso) + hours * HOUR).toISOString();
}

const dateTimeFmt = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFmt = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDateTime = (iso: string): string => dateTimeFmt.format(new Date(iso));
export const formatTime = (iso: string): string => timeFmt.format(new Date(iso));

/** "2 ชม. 15 นาที" style duration for SLA countdowns. */
export function formatDuration(totalMs: number): string {
  const abs = Math.abs(totalMs);
  const d = Math.floor(abs / (24 * HOUR));
  const h = Math.floor((abs % (24 * HOUR)) / HOUR);
  const m = Math.floor((abs % HOUR) / MIN);
  const parts: string[] = [];
  if (d) parts.push(`${d} วัน`);
  if (h) parts.push(`${h} ชม.`);
  if (!d && m) parts.push(`${m} นาที`);
  return parts.length ? parts.join(' ') : '0 นาที';
}

/** ISO → value for <input type="datetime-local"> in Bangkok time (UTC+7, no DST). */
export function toBangkokInput(iso: string): string {
  return new Date(ms(iso) + 7 * HOUR).toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value (Bangkok time) → ISO. Empty string stays empty. */
export function fromBangkokInput(v: string): string {
  return v ? new Date(`${v}:00+07:00`).toISOString() : '';
}
