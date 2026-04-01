import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserProfile } from '../types/health';
import { PROFILE_KEY } from '../constants/keys';
import { storageGet, storageSet } from '../lib/storage/core';

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  weightKg: 70,
  heightCm: 170,
  age: 30,
  sex: 'other',
};

interface ProfileContextValue {
  profile: UserProfile;
  isProfileComplete: boolean;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    storageGet<UserProfile>(PROFILE_KEY, DEFAULT_PROFILE).then(setProfile);
  }, []);

  const updateProfile = async (patch: Partial<UserProfile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    await storageSet(PROFILE_KEY, next);
  };

  // Profile is complete once a name and non-default weight are set
  const isProfileComplete = profile.name.trim().length > 0 && profile.weightKg !== DEFAULT_PROFILE.weightKg;

  return (
    <ProfileContext.Provider value={{ profile, isProfileComplete, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
