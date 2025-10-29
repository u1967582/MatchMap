import { useState, useEffect, useRef } from 'react';

export interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  expired: boolean;
}

/**
 * Hook for countdown timer
 * @param endAt End date/time
 * @returns Countdown time object updated every second
 */
export function useCountdown(endAt: string | Date | null | undefined): CountdownTime {
  const [countdown, setCountdown] = useState<CountdownTime>(() =>
    calculateCountdown(endAt)
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!endAt) {
      setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, expired: true });
      return;
    }

    // Update immediately
    setCountdown(calculateCountdown(endAt));

    // Then update every second
    intervalRef.current = setInterval(() => {
      const newCountdown = calculateCountdown(endAt);
      setCountdown(newCountdown);

      // Clear interval if expired
      if (newCountdown.expired && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [endAt]);

  return countdown;
}

function calculateCountdown(endAt: string | Date | null | undefined): CountdownTime {
  if (!endAt) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, expired: true };
  }

  const endDate = typeof endAt === 'string' ? new Date(endAt) : endAt;
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, expired: true };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    expired: false,
  };
}

/**
 * Format countdown for display
 */
export function formatCountdown(countdown: CountdownTime): string {
  const { days, hours, minutes, seconds, expired } = countdown;

  if (expired) return 'Expirado';

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

  return parts.join(' ');
}
