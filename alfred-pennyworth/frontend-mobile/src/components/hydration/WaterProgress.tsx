import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from '../common/ProgressBar';
import { Card } from '../common/Card';
import { colors } from '../../theme/colors';

interface Props {
  totalMl: number;
  goalMl: number;
  pct: number;
  remaining: number;
}

export function WaterProgress({ totalMl, goalMl, pct, remaining }: Props) {
  return (
    <Card>
      <Text style={styles.hero}>{totalMl} ml</Text>
      <Text style={styles.sub}>of {goalMl} ml goal</Text>
      <ProgressBar pct={pct} color={colors.blue} height={10} />
      <Text style={styles.remaining}>{remaining} ml remaining</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero:      { fontSize: 42, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sub:       { color: colors.subtext, textAlign: 'center', marginBottom: 12, fontSize: 14 },
  remaining: { color: colors.subtext, textAlign: 'center', marginTop: 6, fontSize: 13 },
});
