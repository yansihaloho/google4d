import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTotoLatestQueryKey,
  getGetTotoMonthsQueryKey,
  getGetTotoScheduleQueryKey,
} from "@workspace/api-client-react";

const DRAW_TIMES_WIB = [
  { hour: 0, minute: 1 },
  { hour: 13, minute: 0 },
  { hour: 16, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 22, minute: 0 },
  { hour: 23, minute: 0 },
];

const ACTIVE_WINDOW_MINUTES = 5;
const ACTIVE_INTERVAL_MS = 30_000;
const IDLE_INTERVAL_MS = 5 * 60_000;

function getWIBMinutes(): number {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + 7 * 60) % (24 * 60);
}

function isNearDrawTime(): boolean {
  const current = getWIBMinutes();
  for (const { hour, minute } of DRAW_TIMES_WIB) {
    const drawMinutes = hour * 60 + minute;
    const delta = (current - drawMinutes + 24 * 60) % (24 * 60);
    if (delta >= 0 && delta <= ACTIVE_WINDOW_MINUTES) {
      return true;
    }
  }
  return false;
}

function getNextDrawLabel(): string {
  const current = getWIBMinutes();
  for (const { hour, minute } of DRAW_TIMES_WIB) {
    const drawMinutes = hour * 60 + minute;
    if (drawMinutes > current) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }
  return "00:01";
}

export interface AutoRefreshState {
  isActive: boolean;
  lastRefreshed: Date | null;
  nextDrawLabel: string;
}

export function useAutoRefresh(): AutoRefreshState {
  const queryClient = useQueryClient();
  const [isActive, setIsActive] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [nextDrawLabel, setNextDrawLabel] = useState(getNextDrawLabel);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invalidateAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getGetTotoLatestQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetTotoMonthsQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetTotoScheduleQueryKey() });
    setLastRefreshed(new Date());
  }, [queryClient]);

  useEffect(() => {
    let active = true;

    function schedule() {
      if (!active) return;

      const near = isNearDrawTime();
      setIsActive(near);
      setNextDrawLabel(getNextDrawLabel());

      const interval = near ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;

      timerRef.current = setTimeout(async () => {
        if (!active) return;
        await invalidateAll();
        schedule();
      }, interval);
    }

    schedule();

    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [invalidateAll]);

  return { isActive, lastRefreshed, nextDrawLabel };
}
