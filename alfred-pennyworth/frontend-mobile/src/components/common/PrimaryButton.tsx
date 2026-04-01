import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, color = colors.blue, style, disabled }: Props) {
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: color, opacity: disabled ? 0.5 : 1 }, style]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:   { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  label: { color: colors.text, fontWeight: '700', fontSize: 15 },
});
