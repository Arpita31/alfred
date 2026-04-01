import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  score: number | null;
  hours: string | null;
}

function scoreColor(score: number): string {
  if (score >= 80) return colors.green;
  if (score >= 60) return colors.yellow;
  return colors.red;
}

export function SleepScoreRing({ score, hours }: Props) {
  if (score === null) {
    return (
      <View style={styles.ring}>
        <Text style={styles.noData}>—</Text>
        <Text style={styles.label}>No data</Text>
      </View>
    );
  }

  const color = scoreColor(score);
  return (
    <View style={[styles.ring, { borderColor: color }]}>
      <Text style={[styles.score, { color }]}>{score}</Text>
      <Text style={styles.label}>{hours ?? ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring:   { width: 110, height: 110, borderRadius: 55, borderWidth: 5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 8 },
  score:  { fontSize: 36, fontWeight: '800' },
  noData: { fontSize: 30, color: colors.subtext },
  label:  { color: colors.subtext, fontSize: 13 },
});
