import { useState, useMemo, useCallback } from 'react';
import { useActivity as useActivityCtx } from '../context/ActivityContext';
import { useApp } from '../context/AppContext';
import {
  parseSmartInput, calcTrainingLoad, calcStreak,
  calcRecovery, getCoachingTips, calcWeekOverWeek,
  getPersonalBaseline, getNextWorkoutSuggestion, activityIcon, inferIntensity,
} from '../lib/ml/activity';
import { localDateStr } from '../lib/storage/core';

export interface ActivityVM {
  history: ReturnType<typeof useActivityCtx>['history'];
  // form
  smartInput: string;
  activityType: string;
  duration: number;
  setSmartInput: (v: string) => void;
  setActivityType: (v: string) => void;
  setDuration: (v: number) => void;
  parseInput: () => void;
  save: () => Promise<void>;
  // computed
  trainingLoad: number;
  streak: number;
  recovery: { label: string; score: number; color: string };
  tips: string[];
  weekOverWeek: ReturnType<typeof calcWeekOverWeek>;
  baseline: number | null;
  nextSuggestion: string;
  icon: string;
}

export function useActivity(): ActivityVM {
  const { history, saveActivity } = useActivityCtx();
  const { sharedCtx } = useApp();

  const [smartInput, setSmartInput] = useState('');
  const [activityType, setActivityType] = useState('walking');
  const [duration, setDuration] = useState(30);

  const parseInput = useCallback(() => {
    const parsed = parseSmartInput(smartInput);
    if (parsed.type)     setActivityType(parsed.type);
    if (parsed.duration) setDuration(parsed.duration);
  }, [smartInput]);

  const save = useCallback(async () => {
    await saveActivity({
      type: activityType,
      duration,
      start: new Date(Date.now() - duration * 60_000).toISOString(),
    });
    setSmartInput('');
    setDuration(30);
  }, [activityType, duration, saveActivity]);

  const computed = useMemo(() => {
    const recovery = calcRecovery(history, sharedCtx.lastSleepHours);
    const intensity = inferIntensity(activityType);
    return {
      trainingLoad: calcTrainingLoad(history),
      streak: calcStreak(history, localDateStr()),
      recovery,
      tips: getCoachingTips(intensity, recovery, sharedCtx.lastSleepHours),
      weekOverWeek: calcWeekOverWeek(history),
      baseline: getPersonalBaseline(activityType, history),
      nextSuggestion: getNextWorkoutSuggestion(history, recovery),
      icon: activityIcon(activityType),
    };
  }, [history, activityType, sharedCtx.lastSleepHours]);

  return {
    history,
    smartInput, activityType, duration,
    setSmartInput, setActivityType, setDuration,
    parseInput, save,
    ...computed,
  };
}
