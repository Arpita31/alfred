import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SLEEP_QUALITY_OPTIONS } from '../../constants/options';
import { colors } from '../../theme/colors';

interface Props {
  value: number;
  onChange: (v: number) => void;
}

export function QualityPicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {SLEEP_QUALITY_OPTIONS.map(({ label, value: v }) => (
        <TouchableOpacity
          key={v}
          style={[styles.chip, value === v && styles.active]}
          onPress={() => onChange(v)}
        >
          <Text style={[styles.label, value === v && styles.activeLabel]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:        { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  active:      { backgroundColor: colors.purple, borderColor: colors.purple },
  label:       { color: colors.subtext, fontSize: 12 },
  activeLabel: { color: colors.text, fontWeight: '600' },
});
