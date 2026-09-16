export type Clock = () => Date;

const calendarPattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const timestampPattern =
  /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;

export function isCalendarDate(value: string): boolean {
  if (!calendarPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function isTimestampOrDate(value: string): boolean {
  if (isCalendarDate(value)) return true;
  const match = timestampPattern.exec(value);
  return match?.[1] !== undefined && isCalendarDate(match[1]);
}

/** Capture this once at an operation boundary, using the caller's local date. */
export function invocationDate(clock: Clock = () => new Date()): string {
  const date = clock();
  if (!Number.isFinite(date.getTime()))
    throw new Error('Clock returned an invalid date');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${month}-${day}`;
}

export interface ReviewStatus {
  readonly stale: boolean;
  readonly deadline?: string;
  readonly daysOverdue?: number;
}

export function reviewStatus(
  deadline: string | undefined,
  today: string
): ReviewStatus {
  if (!isCalendarDate(today)) throw new Error('Invalid review comparison date');
  if (deadline === undefined) return { stale: false };
  if (!isCalendarDate(deadline)) throw new Error('Invalid review deadline');
  const elapsed =
    Date.parse(`${today}T00:00:00Z`) - Date.parse(`${deadline}T00:00:00Z`);
  return {
    deadline,
    stale: elapsed >= 0,
    daysOverdue: Math.max(0, elapsed / 86_400_000),
  };
}
