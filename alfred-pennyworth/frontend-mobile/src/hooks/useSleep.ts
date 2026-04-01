import { useState, useMemo, useCallback } from 'react';
import { useSleep as useSleepCtx } from '../context/SleepContext';
import {
  calcSleepScore, calcSleepDebt, getChronotype,
  getBedtimeRec, sleepTrend, tagImpactMap, predictSleepQuality, fmtDur,
} from '../lib/ml/sleep';

export interface SleepVM {
  history: ReturnType<typeof useSleepCtx>['history'];
  // form state
  startTime: string;
  endTime: string;
  quality: number;
  selectedTags: string[];
  setStartTime: (v: string) => void;
  setEndTime: (v: string) => void;
  setQuality: (v: number) => void;
  toggleTag: (tag: string) => void;
  save: () => Promise<void>;
  logNap: (hours: number) => Promise<void>;
  // computed
  debt: number;
  chronotype: string | null;
  bedtimeRec: string;
  trend: ReturnType<typeof sleepTrend>;
  tagImpact: Record<string, number>;
  predictedQuality: number | null;
  lastScore: number | null;
  lastHours: string | null;
}

export function useSleep(): SleepVM {
  const { history, saveSleep, logNap } = useSleepCtx();

  const [startTime, setStartTime] = useState('23:00');
  const [endTime, setEndTime]     = useState('07:00');
  const [quality, setQuality]     = useState(7);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  }, []);

  const save = useCallback(async () => {
    const now   = new Date();
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);

    const start = new Date(now);
    start.setHours(sh, sm, 0, 0);
    if (sh > eh) start.setDate(start.getDate() - 1); // previous night

    const end = new Date(now);
    end.setHours(eh, em, 0, 0);

    const hours = (end.getTime() - start.getTime()) / 3_600_000;
    await saveSleep({ start: start.toISOString(), end: end.toISOString(), hours, quality, tags: selectedTags });
    setSelectedTags([]);
  }, [startTime, endTime, quality, selectedTags, saveSleep]);

  const computed = useMemo(() => {
    const impacts = tagImpactMap(history);
    const lastSleep = history[0];
    const computedHours = lastSleep
      ? (new Date(lastSleep.end).getTime() - new Date(lastSleep.start).getTime()) / 3_600_000
      : null;
    return {
      debt: calcSleepDebt(history),
      chronotype: getChronotype(history),
      bedtimeRec: getBedtimeRec(history),
      trend: sleepTrend(history),
      tagImpact: impacts,
      predictedQuality: predictSleepQuality(selectedTags, computedHours ?? 0, history, impacts),
      lastScore: lastSleep?.score ?? null,
      lastHours: lastSleep ? fmtDur(computedHours!) : null,
    };
  }, [history, selectedTags]);

  return {
    history,
    startTime, endTime, quality, selectedTags,
    setStartTime, setEndTime, setQuality, toggleTag,
    save, logNap,
    ...computed,
  };
}
