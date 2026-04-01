import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';

interface TimePickerProps {
  label: string;
  value: string;          // "HH:MM"
  onChange: (v: string) => void;
}

function hhmm(date: Date): string {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join(':');
}

function fromHHMM(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function TimePicker({ label, value, onChange }: TimePickerProps) {
  const [show, setShow] = useState(false);
  const date = fromHHMM(value);

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShow(false);
    if (selected) onChange(hhmm(selected));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.pill} onPress={() => setShow(true)}>
        <Text style={styles.time}>{value}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={date}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={handleChange}
          themeVariant="dark"
        />
      )}
      {show && Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.done} onPress={() => setShow(false)}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label:     { color: colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  pill: {
    backgroundColor: colors.surface2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    minWidth: 90,
    alignItems: 'center',
  },
  time:     { color: colors.text, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  done:     { alignSelf: 'flex-end', marginTop: 4 },
  doneText: { color: colors.accent, fontWeight: '700' },
});
