import { format, isToday, isYesterday, isThisYear } from 'date-fns';

export function formatExpenseDate(dateString: string): string {
  const date = new Date(dateString);

  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisYear(date)) return format(date, 'MMM d');
  return format(date, 'MMM d, yyyy');
}
