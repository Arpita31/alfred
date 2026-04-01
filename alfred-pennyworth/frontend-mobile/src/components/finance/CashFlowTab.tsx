import { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { FinanceVM } from '../../hooks/useFinance';
import { IncomeStream, Expense } from '../../types/finance';
import { Card } from '../common/Card';
import { SectionLabel } from '../common/SectionLabel';
import { ListItem } from '../common/ListItem';
import { GhostButton } from '../common/GhostButton';
import { ButtonRow } from '../common/ButtonRow';
import { ProgressBar } from '../common/ProgressBar';
import { StyledInput } from '../common/StyledInput';
import { colors } from '../../theme/colors';
import { formatMoney } from '../../lib/ml/finance';
import { getStatusColor } from '../../lib/ui/statusColor';

type Props = Pick<FinanceVM,
  'finance' | 'monthlyIncome' | 'monthlyExpenses' | 'savingsRate' |
  'addIncome' | 'removeIncome' | 'addExpense' | 'removeExpense'
>;

const EMPTY = { name: '', amount: '' };

export function CashFlowTab({ finance, monthlyIncome, monthlyExpenses, savingsRate, addIncome, removeIncome, addExpense, removeExpense }: Props) {
  const [incomeForm,  setIncomeForm]  = useState<{ name: string; amount: string; isPassive: boolean } | null>(null);
  const [expenseForm, setExpenseForm] = useState<typeof EMPTY | null>(null);

  const cashFlow = monthlyIncome - monthlyExpenses;

  const submitIncome = async () => {
    if (!incomeForm?.name || !incomeForm.amount) return;
    await addIncome({ name: incomeForm.name, monthlyAmount: parseFloat(incomeForm.amount) || 0, type: 'salary', isPassive: incomeForm.isPassive });
    setIncomeForm(null);
  };

  const submitExpense = async () => {
    if (!expenseForm?.name || !expenseForm.amount) return;
    await addExpense({ name: expenseForm.name, monthlyAmount: parseFloat(expenseForm.amount) || 0, category: 'other', isFixed: false });
    setExpenseForm(null);
  };

  return (
    <View>
      {/* Income */}
      <Card>
        <View style={styles.sectionHeader}>
          <SectionLabel label="income streams" />
          <Text style={[styles.total, { color: colors.green }]}>{formatMoney(monthlyIncome, true)}/mo</Text>
        </View>
        {finance.income.map((s: IncomeStream) => (
          <ListItem
            key={s.id}
            primary={s.name}
            badge={s.isPassive ? '💰 passive' : '💼 active'}
            value={formatMoney(s.monthlyAmount, true)}
            valueColor={colors.green}
            onDelete={() => removeIncome(s.id)}
          />
        ))}
        <GhostButton label="+ Income Stream" onPress={() => setIncomeForm({ name: '', amount: '', isPassive: false })} color={colors.green} style={styles.addBtn} />
      </Card>

      {incomeForm && (
        <Card>
          <SectionLabel label="new income stream" />
          <StyledInput placeholder="Stream name" value={incomeForm.name} onChangeText={v => setIncomeForm(f => f ? { ...f, name: v } : f)} />
          <StyledInput placeholder="Monthly amount ($)" value={incomeForm.amount} onChangeText={v => setIncomeForm(f => f ? { ...f, amount: v } : f)} keyboardType="numeric" />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Passive income?</Text>
            <Switch value={incomeForm.isPassive} onValueChange={v => setIncomeForm(f => f ? { ...f, isPassive: v } : f)} trackColor={{ true: colors.green }} />
          </View>
          <ButtonRow actions={[
            { label: 'Add', onPress: submitIncome, color: colors.green },
            { label: 'Cancel', onPress: () => setIncomeForm(null), ghost: true },
          ]} />
        </Card>
      )}

      {/* Expenses */}
      <Card>
        <View style={styles.sectionHeader}>
          <SectionLabel label="monthly expenses" />
          <Text style={[styles.total, { color: colors.red }]}>−{formatMoney(monthlyExpenses, true)}/mo</Text>
        </View>
        {finance.expenses.map((e: Expense) => (
          <ListItem
            key={e.id}
            primary={e.name}
            secondary={e.category}
            value={`−${formatMoney(e.monthlyAmount, true)}`}
            valueColor={colors.red}
            onDelete={() => removeExpense(e.id)}
          />
        ))}
        <GhostButton label="+ Expense" onPress={() => setExpenseForm(EMPTY)} color={colors.red} style={styles.addBtn} />
      </Card>

      {expenseForm && (
        <Card>
          <SectionLabel label="new expense" />
          <StyledInput placeholder="Expense name" value={expenseForm.name} onChangeText={v => setExpenseForm(f => f ? { ...f, name: v } : f)} />
          <StyledInput placeholder="Monthly amount ($)" value={expenseForm.amount} onChangeText={v => setExpenseForm(f => f ? { ...f, amount: v } : f)} keyboardType="numeric" />
          <ButtonRow actions={[
            { label: 'Add', onPress: submitExpense, color: colors.red },
            { label: 'Cancel', onPress: () => setExpenseForm(null), ghost: true },
          ]} />
        </Card>
      )}

      {/* Net flow summary */}
      <Card>
        <SectionLabel label="net flow" />
        <ListItem primary="Income"   value={formatMoney(monthlyIncome)}   valueColor={colors.green} />
        <ListItem primary="Expenses" value={`−${formatMoney(monthlyExpenses)}`} valueColor={colors.red} />
        <View style={styles.netRow}>
          <Text style={styles.netLabel}>Net Flow</Text>
          <Text style={[styles.netValue, { color: cashFlow >= 0 ? colors.green : colors.red }]}>{formatMoney(cashFlow)}</Text>
        </View>
        <ProgressBar pct={savingsRate} color={getStatusColor(savingsRate, [30, 15])} height={8} />
        <Text style={styles.hint}>Savings rate: {savingsRate}% · Target: 30–60%</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total:         { fontWeight: '700', fontSize: 14 },
  addBtn:        { marginTop: 8 },
  switchRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  switchLabel:   { color: colors.muted, fontSize: 13, flex: 1 },
  netRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 },
  netLabel:      { color: colors.text, fontWeight: '700', fontSize: 15 },
  netValue:      { fontWeight: '700', fontSize: 15 },
  hint:          { color: colors.muted, fontSize: 11, marginTop: 6 },
});
