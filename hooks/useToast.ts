import { useToastStore } from '../lib/toast';

export function useToast() {
  const show = useToastStore((s) => s.show);

  return {
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error'),
    info: (message: string) => show(message, 'neutral'),
  };
}
