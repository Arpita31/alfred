import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { colors } from '../../theme/colors';

interface Props {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

export function StatCard({ label, value, sub, color = colors.blue }: Props) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card:  { flex: 1, margin: 4 },
  label: { color: colors.subtext, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  value: { fontSize: 22, fontWeight: '700' },
  sub:   { color: colors.subtext, fontSize: 12, marginTop: 2 },
});
