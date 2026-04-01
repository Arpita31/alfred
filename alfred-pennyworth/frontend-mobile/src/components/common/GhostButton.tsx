import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
}

export function GhostButton({ label, onPress, color = colors.blue, style }: Props) {
  return (
    <TouchableOpacity style={[styles.btn, { borderColor: color }, style]} onPress={onPress}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:   { borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: 1 },
  label: { fontWeight: '600', fontSize: 14 },
});
