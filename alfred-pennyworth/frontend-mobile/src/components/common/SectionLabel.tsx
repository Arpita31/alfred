import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props { label: string }

export function SectionLabel({ label }: Props) {
  return <Text style={styles.label}>{label.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  label: { color: colors.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
});
