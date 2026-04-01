import React, { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { StyledInput } from '../components/common/StyledInput';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { Card } from '../components/common/Card';
import { SectionLabel } from '../components/common/SectionLabel';
import { colors } from '../theme/colors';
import { UserSex } from '../types/health';

const SEX_OPTIONS: { key: UserSex; label: string }[] = [
  { key: 'male',   label: 'Male'   },
  { key: 'female', label: 'Female' },
  { key: 'other',  label: 'Other'  },
];

export function ProfileScreen() {
  const { profile, updateProfile } = useProfile();
  const { logout } = useAuth();

  const [name,     setName]     = useState(profile.name);
  const [weight,   setWeight]   = useState(String(profile.weightKg));
  const [height,   setHeight]   = useState(String(profile.heightCm));
  const [age,      setAge]      = useState(String(profile.age));
  const [sex,      setSex]      = useState<UserSex>(profile.sex);
  const [saved,    setSaved]    = useState(false);

  // Keep local state in sync if profile loads asynchronously
  useEffect(() => {
    setName(profile.name);
    setWeight(String(profile.weightKg));
    setHeight(String(profile.heightCm));
    setAge(String(profile.age));
    setSex(profile.sex);
  }, [profile]);

  const handleSave = async () => {
    await updateProfile({
      name:     name.trim(),
      weightKg: parseFloat(weight) || profile.weightKg,
      heightCm: parseFloat(height) || profile.heightCm,
      age:      parseInt(age, 10)  || profile.age,
      sex,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Profile" subtitle="Alfred uses this to personalise your goals." />

        <Card>
          <SectionLabel label="Name" />
          <StyledInput value={name} onChangeText={setName} placeholder="Your name" autoCorrect={false} />

          <SectionLabel label="Weight (kg)" />
          <StyledInput value={weight} onChangeText={setWeight} placeholder="70" keyboardType="decimal-pad" />

          <SectionLabel label="Height (cm)" />
          <StyledInput value={height} onChangeText={setHeight} placeholder="170" keyboardType="decimal-pad" />

          <SectionLabel label="Age" />
          <StyledInput value={age} onChangeText={setAge} placeholder="30" keyboardType="number-pad" />

          <SectionLabel label="Sex" />
          <View style={styles.sexRow}>
            {SEX_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sexBtn, sex === opt.key && styles.sexBtnActive]}
                onPress={() => setSex(opt.key)}
              >
                <Text style={[styles.sexLabel, sex === opt.key && styles.sexLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <PrimaryButton
          label={saved ? '✓ Saved' : 'Save profile'}
          onPress={handleSave}
          color={saved ? colors.green : colors.accent}
        />

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: colors.bg },
  content:        { padding: 16, paddingBottom: 40 },
  sexRow:         { flexDirection: 'row', gap: 10, marginTop: 4 },
  sexBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface2,
  },
  sexBtnActive:   { borderColor: colors.accent, backgroundColor: colors.surface3 },
  sexLabel:       { color: colors.muted, fontWeight: '600', fontSize: 13 },
  sexLabelActive: { color: colors.accent },
  logoutBtn:      { marginTop: 24, alignItems: 'center', paddingVertical: 12 },
  logoutText:     { color: colors.red, fontWeight: '600', fontSize: 14 },
});
