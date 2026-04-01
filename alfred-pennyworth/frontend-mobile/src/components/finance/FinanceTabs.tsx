import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { FinanceTab } from '../../hooks/useFinance';
import { FINANCE_TABS } from '../../constants/options';
import { colors } from '../../theme/colors';

interface Props {
  active: FinanceTab;
  onChange: (t: FinanceTab) => void;
}

export function FinanceTabs({ active, onChange }: Props) {
  return (
    <View style={styles.row}>
      {FINANCE_TABS.map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={[styles.tab, active === key && styles.activeTab]}
          onPress={() => onChange(key as FinanceTab)}
        >
          <Text style={[styles.label, active === key && styles.activeLabel]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row:         { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 3, marginBottom: 12 },
  tab:         { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activeTab:   { backgroundColor: colors.blue },
  label:       { color: colors.subtext, fontSize: 12, fontWeight: '600' },
  activeLabel: { color: colors.text },
});
