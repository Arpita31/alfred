import { useState, useCallback } from 'react';
import { NutritionPreview } from '../types/health';
import { createMeal, parseMeal } from '../lib/api/meals';
import { useApp } from '../context/AppContext';

type Phase = 'idle' | 'parsing' | 'preview' | 'saving' | 'done' | 'error';

export interface NutritionVM {
  phase: Phase;
  preview: NutritionPreview | null;
  error: string | null;
  mealInput: string;
  mealType: string;
  setMealInput: (v: string) => void;
  setMealType: (v: string) => void;
  parse: () => Promise<void>;
  confirm: () => Promise<void>;
  reset: () => void;
}

export function useNutrition(): NutritionVM {
  const { userId, patchSharedCtx, sharedCtx } = useApp();
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<NutritionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mealInput, setMealInput] = useState('');
  const [mealType, setMealType] = useState('lunch');

  const parse = useCallback(async () => {
    if (!mealInput.trim()) return;
    setPhase('parsing');
    setError(null);
    try {
      const result = await parseMeal(mealInput);
      setPreview(result);
      setPhase('preview');
    } catch {
      setError('Could not parse meal. Try again.');
      setPhase('error');
    }
  }, [mealInput]);

  const confirm = useCallback(async () => {
    if (!preview) return;
    setPhase('saving');
    try {
      await createMeal({
        user_id: userId,
        meal_type: mealType,
        description: mealInput,
        calories: preview.calories,
        protein_g: preview.protein_g,
        carbs_g: preview.carbs_g,
        fat_g: preview.fat_g,
        fiber_g: preview.fiber_g,
      });
      await patchSharedCtx({ mealsToday: sharedCtx.mealsToday + 1 });
      setPhase('done');
    } catch {
      setError('Failed to save meal.');
      setPhase('error');
    }
  }, [preview, mealInput, mealType, userId, patchSharedCtx, sharedCtx.mealsToday]);

  const reset = useCallback(() => {
    setPhase('idle');
    setPreview(null);
    setError(null);
    setMealInput('');
  }, []);

  return { phase, preview, error, mealInput, mealType, setMealInput, setMealType, parse, confirm, reset };
}
