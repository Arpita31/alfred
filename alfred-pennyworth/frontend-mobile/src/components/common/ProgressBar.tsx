import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  pct: number;
  color?: string;
  height?: number;
  trackColor?: string;
}

export function ProgressBar({ pct, color = colors.blue, height = 8, trackColor = colors.surface }: Props) {
  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }]}>
      <View style={[styles.fill, { width: `${Math.min(100, pct)}%`, backgroundColor: color, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 4, overflow: 'hidden', width: '100%' },
  fill:  { borderRadius: 4 },
});
