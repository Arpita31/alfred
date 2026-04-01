import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSend, disabled }: Props) {
  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="Ask Alfred…"
        placeholderTextColor={colors.subtext}
        multiline
      />
      <TouchableOpacity style={[styles.send, (disabled || !value.trim()) && styles.sendDisabled]} onPress={onSend} disabled={disabled || !value.trim()}>
        <Text style={styles.sendLabel}>↑</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row:          { flexDirection: 'row', gap: 8, alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  input:        { flex: 1, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontSize: 14, maxHeight: 100 },
  send:         { backgroundColor: colors.blue, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
  sendLabel:    { color: colors.text, fontSize: 18, fontWeight: '700' },
});
