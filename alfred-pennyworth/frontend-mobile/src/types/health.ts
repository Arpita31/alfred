export type SleepRecord = {
  date: string;
  start: string;
  end: string;
  hours: number;
  quality: number;
  score: number;
  tags: string[];
};

export type ActivityIntensity = 'low' | 'moderate' | 'high';

export type ActivityRecord = {
  date: string;
  type: string;
  duration: number;
  calories: number;
  intensity: ActivityIntensity;
  start: string;
};

export type WaterHistory = {
  date: string;
  totalMl: number;
  goalMl: number;
};

export type NutritionPreview = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: number;
  method: 'template' | 'parsed' | 'fallback' | 'ai';
  dish_matched: string | null;
};

export type AppContext = {
  mealsToday: number;
  lastSleepHours: number | null;
  lastSleepQuality: number | null;
  activityMinutesToday: number;
};

export type UserSex = 'male' | 'female' | 'other';

export type UserProfile = {
  name: string;
  weightKg: number;
  heightCm: number;
  age: number;
  sex: UserSex;
};
