import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { PrimaryButton } from '../common/PrimaryButton';
import { colors } from '../../theme/colors';

interface Field {
  key: string;
  label: string;
  placeholder: string;
  numeric?: boolean;
}

interface Props {
  title: string;
  fields: Field[];
  onSubmit: (values: Record<string, string>) => void;
  submitColor?: string;
}

export function AddItemForm({ title, fields, onSubmit, submitColor }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, ''])),
  );

  const handleSubmit = () => {
    onSubmit(values);
    setValues(Object.fromEntries(fields.map(f => [f.key, ''])));
  };

  const isValid = fields.every(f => !f.numeric || !isNaN(parseFloat(values[f.key])));

  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {fields.map(f => (
        <TextInput
          key={f.key}
          style={styles.input}
          placeholder={f.placeholder}
          placeholderTextColor={colors.subtext}
          value={values[f.key]}
          onChangeText={v => setValues(prev => ({ ...prev, [f.key]: v }))}
          keyboardType={f.numeric ? 'numeric' : 'default'}
        />
      ))}
      <PrimaryButton label={`Add ${title}`} onPress={handleSubmit} color={submitColor} disabled={!isValid} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 10 },
  input: { backgroundColor: colors.bg, borderRadius: 8, padding: 12, color: colors.text, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
});
