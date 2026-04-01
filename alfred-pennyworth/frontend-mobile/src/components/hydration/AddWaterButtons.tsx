import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { WATER_AMOUNTS } from '../../constants/options';
import { colors } from '../../theme/colors';

interface Props {
  onAdd: (ml: number) => void;
}

export function AddWaterButtons({ onAdd }: Props) {
  return (
    <View style={styles.row}>
      {WATER_AMOUNTS.map(({ label, ml }) => (
        <TouchableOpacity key={ml} style={styles.btn} onPress={() => onAdd(ml)}>
          <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  btn:   { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.text, fontWeight: '600', fontSize: 14 },
});
