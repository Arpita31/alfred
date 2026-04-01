import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFinance } from '../hooks/useFinance';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { OverviewTab } from '../components/finance/OverviewTab';
import { BalanceTab } from '../components/finance/BalanceTab';
import { CashFlowTab } from '../components/finance/CashFlowTab';
import { FITrackerTab } from '../components/finance/FITrackerTab';
import { colors } from '../theme/colors';
import { FINANCE_TABS } from '../constants/options';
import { useMemo } from 'react';

function buildInsights(savingsRate: number, monthlyIncome: number, runwayMonths: number, monthlyExpenses: number, passiveRatio: number, fiProgress: number, yearsToFI: number): string[] {
  const out: string[] = [];
  if (savingsRate < 10 && monthlyIncome > 0)  out.push('Savings rate below 10% — reduce fixed expenses or increase income.');
  if (savingsRate >= 30)                        out.push(`${savingsRate}% savings rate — excellent wealth-building pace.`);
  if (runwayMonths < 3 && monthlyExpenses > 0) out.push(`Only ${runwayMonths}mo runway — build emergency fund before investing.`);
  if (passiveRatio > 20)                        out.push(`${passiveRatio}% passive income — great diversification progress.`);
  if (fiProgress > 0)                           out.push(`${fiProgress}% toward FI — ${yearsToFI} years at current trajectory.`);
  return out.slice(0, 3);
}

export function FinanceScreen() {
  const vm = useFinance();
  const { activeTab, setActiveTab, netWorth, netWorthFmt, savingsRate, passiveRatio, fiNumber, yearsToFI, runwayMonths, monthlyIncome, monthlyExpenses } = vm;

  const cashFlow  = monthlyIncome - monthlyExpenses;
  const fiProgress = fiNumber > 0 ? Math.min(100, Math.round((Math.max(0, netWorth) / fiNumber) * 100)) : 0;
  const insights  = useMemo(
    () => buildInsights(savingsRate, monthlyIncome, runwayMonths, monthlyExpenses, passiveRatio, fiProgress, yearsToFI),
    [savingsRate, monthlyIncome, runwayMonths, monthlyExpenses, passiveRatio, fiProgress, yearsToFI],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Finance"
        subtitle="Balance sheet · Wealth architecture"
        right={netWorth !== 0 ? (
          <View style={styles.nwBadge}>
            <Text style={styles.nwLabel}>NET WORTH</Text>
            <Text style={[styles.nwValue, { color: netWorth >= 0 ? colors.green : colors.red }]}>{netWorthFmt}</Text>
          </View>
        ) : undefined}
      />

      {/* Tab selector */}
      <View style={styles.tabRow}>
        {FINANCE_TABS.map(({ key, label }) => (
          <TouchableOpacity key={key} style={[styles.tab, activeTab === key && styles.tabActive]} onPress={() => setActiveTab(key)}>
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'overview'  && <OverviewTab  savingsRate={savingsRate} passiveRatio={passiveRatio} runwayMonths={runwayMonths} monthlyIncome={monthlyIncome} monthlyExpenses={monthlyExpenses} fiProgress={fiProgress} yearsToFI={yearsToFI} cashFlow={cashFlow} insights={insights} />}
      {activeTab === 'balance'   && <BalanceTab   finance={vm.finance} netWorth={netWorth} netWorthFmt={netWorthFmt} addAsset={vm.addAsset} removeAsset={vm.removeAsset} addLiability={vm.addLiability} removeLiability={vm.removeLiability} />}
      {activeTab === 'cashflow'  && <CashFlowTab  finance={vm.finance} monthlyIncome={monthlyIncome} monthlyExpenses={monthlyExpenses} savingsRate={savingsRate} addIncome={vm.addIncome} removeIncome={vm.removeIncome} addExpense={vm.addExpense} removeExpense={vm.removeExpense} />}
      {activeTab === 'fi'        && <FITrackerTab netWorth={netWorth} fiNumber={fiNumber} yearsToFI={yearsToFI} monthlyExpenses={monthlyExpenses} monthlyIncome={monthlyIncome} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: colors.bg },
  content:      { padding: 16, paddingBottom: 40 },
  nwBadge:      { alignItems: 'flex-end' },
  nwLabel:      { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  nwValue:      { fontSize: 18, fontWeight: '700' },
  tabRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tab:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  tabActive:    { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: colors.accent },
  tabText:      { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.accent },
});
