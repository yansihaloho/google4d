import { useEffect, useState } from "react";

const DRAW_TIMES_WIB = [
  { hour: 0, minute: 1 },
  { hour: 13, minute: 0 },
  { hour: 16, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 22, minute: 0 },
  { hour: 23, minute: 0 },
];

function getWIBSeconds(): number {
  const now = new Date();
  const utcSeconds = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  return (utcSeconds + 7 * 3600) % (24 * 3600);
}

export interface CountdownState {
  nextDrawLabel: string;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isImminent: boolean;
}

function computeCountdown(): CountdownState {
  const currentSec = getWIBSeconds();

  for (const { hour, minute } of DRAW_TIMES_WIB) {
    const drawSec = hour * 3600 + minute * 60;
    if (drawSec > currentSec) {
      const remaining = drawSec - currentSec;
      const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      return {
        nextDrawLabel: label,
        hours: Math.floor(remaining / 3600),
        minutes: Math.floor((remaining % 3600) / 60),
        seconds: remaining % 60,
        totalSeconds: remaining,
        isImminent: remaining <= 300,
      };
    }
  }

  const first = DRAW_TIMES_WIB[0]!;
  const drawSec = first.hour * 3600 + first.minute * 60;
  const remaining = 24 * 3600 - currentSec + drawSec;
  return {
    nextDrawLabel: `${String(first.hour).padStart(2, "0")}:${String(first.minute).padStart(2, "0")}`,
    hours: Math.floor(remaining / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
    totalSeconds: remaining,
    isImminent: remaining <= 300,
  };
}

export function useCountdown(): CountdownState {
  const [state, setState] = useState<CountdownState>(computeCountdown);

  useEffect(() => {
    const id = setInterval(() => {
      setState(computeCountdown());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return state;
}
