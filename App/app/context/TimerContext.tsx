// app/context/TimerContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type MatchPhase = 'PRE_MATCH' | 'FIRST_HALF' | 'HALF_TIME' | 'SECOND_HALF' | 'FULL_TIME';

type TimerCtx = {
  time: number;
  phase: MatchPhase;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  nextPhase: () => void;
  formatTime: (seconds: number) => string;
  timerActive: boolean;
  computedMinutePlusOne: () => number;
};

const TimerContext = createContext<TimerCtx | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [time, setTime] = useState(0);
  const [phase, setPhase] = useState<MatchPhase>('PRE_MATCH');
  const [isRunning, setIsRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  const timerActive = isRunning && (phase === 'FIRST_HALF' || phase === 'SECOND_HALF');

  useEffect(() => {
    if (timerActive) {
      ref.current = setInterval(() => setTime(t => t + 1), 1000);
    }
    return () => {
      if (ref.current) { clearInterval(ref.current); ref.current = null; }
    };
  }, [timerActive]);

  const start = () => { if (phase === 'PRE_MATCH') setPhase('FIRST_HALF'); setIsRunning(true); };
  const pause = () => setIsRunning(false);
  const reset = () => { setIsRunning(false); setTime(0); setPhase('PRE_MATCH'); };

  const nextPhase = () => {
    if (phase === 'FIRST_HALF') { setPhase('HALF_TIME'); setTime(45 * 60); setIsRunning(false); }
    else if (phase === 'HALF_TIME') { setPhase('SECOND_HALF'); setIsRunning(true); }
    else if (phase === 'SECOND_HALF') { setPhase('FULL_TIME'); setTime(90 * 60); setIsRunning(false); }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  const computedMinutePlusOne = () => Math.floor(time / 60) + 1;

  const value = useMemo<TimerCtx>(() => ({
    time, phase, isRunning,
    start, pause, reset, nextPhase,
    formatTime, timerActive, computedMinutePlusOne,
  }), [time, phase, isRunning, timerActive]);

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerCtx {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within <TimerProvider>');
  return ctx;
}
