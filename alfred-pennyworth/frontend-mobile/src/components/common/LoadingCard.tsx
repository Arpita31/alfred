import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props { label?: string }

export function LoadingCard({ label = 'Loading…' }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.blue} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  label:     { color: colors.subtext, fontSize: 14 },
});
