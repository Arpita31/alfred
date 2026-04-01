import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NutritionPreview } from '../../types/health';
import { colors } from '../../theme/colors';

interface Props { preview: NutritionPreview }

export function MacroGrid({ preview }: Props) {
  const macros = [
    { label: 'Calories', value: `${preview.calories} kcal`, color: colors.orange },
    { label: 'Protein',  value: `${preview.protein_g}g`,    color: colors.blue },
    { label: 'Carbs',    value: `${preview.carbs_g}g`,      color: colors.green },
    { label: 'Fat',      value: `${preview.fat_g}g`,        color: colors.yellow },
    { label: 'Fiber',    value: `${preview.fiber_g}g`,      color: colors.purple },
  ];

  return (
    <View style={styles.grid}>
      {macros.map(m => (
        <View key={m.label} style={styles.cell}>
          <Text style={[styles.value, { color: m.color }]}>{m.value}</Text>
          <Text style={styles.label}>{m.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  cell:  { alignItems: 'center', width: '30%' },
  value: { fontSize: 18, fontWeight: '700' },
  label: { color: colors.subtext, fontSize: 12, marginTop: 2 },
});
