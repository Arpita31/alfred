import { View, Text, StyleSheet } from 'react-native';
import { FinanceVM } from '../../hooks/useFinance';
import { InfoChipRow } from '../common/InfoChipRow';
import { Card } from '../common/Card';
import { SectionLabel } from '../common/SectionLabel';
import { colors } from '../../theme/colors';
import { formatMoney } from '../../lib/ml/finance';
import { getStatusColor } from '../../lib/ui/statusColor';

interface Props extends Pick<FinanceVM,
  'savingsRate' | 'passiveRatio' | 'runwayMonths' |
  'monthlyIncome' | 'monthlyExpenses' | 'fiProgress' | 'yearsToFI'
> {}

// Derived from useFinance — passed in to keep this component pure/testable
interface FullProps extends Props {
  cashFlow: number;
  insights: string[];
}

export function OverviewTab({ savingsRate, passiveRatio, runwayMonths, monthlyIncome, cashFlow, insights, fiProgress, yearsToFI }: FullProps) {
  return (
    <View>
      <Card>
        <InfoChipRow chips={[
          { label: 'CASH FLOW',    value: formatMoney(cashFlow, true),    color: cashFlow >= 0 ? colors.green : colors.red },
          { label: 'SAVINGS RATE', value: `${savingsRate}%`,              color: getStatusColor(savingsRate, [30, 15]) },
          { label: 'PASSIVE %',    value: `${passiveRatio}%`,             color: getStatusColor(passiveRatio, [20, 10]) },
          { label: 'RUNWAY',       value: `${runwayMonths}mo`,            color: getStatusColor(runwayMonths, [6, 3]) },
        ]} />
      </Card>

      {insights.length > 0 && (
        <Card>
          <SectionLabel label="✦ alfred's wealth intelligence" />
          {insights.map((ins, i) => (
            <View key={i} style={styles.insightRow}>
              <View style={styles.dot} />
              <Text style={styles.insightText}>{ins}</Text>
            </View>
          ))}
        </Card>
      )}

      {monthlyIncome > 0 && (
        <Card>
          <SectionLabel label="income pipeline" />
          <Text style={styles.incomeTotal}>{formatMoney(monthlyIncome, true)}/mo</Text>
          {[
            { pct: '10%', label: 'Buffer',    val: Math.round(monthlyIncome * 0.1), color: colors.blue   },
            { pct: '60%', label: 'Invest',    val: Math.round(monthlyIncome * 0.6), color: colors.accent },
            { pct: '30%', label: 'Lifestyle', val: Math.round(monthlyIncome * 0.3), color: colors.purple },
          ].map(s => (
            <View key={s.label} style={styles.pipeRow}>
              <Text style={[styles.pipePct, { color: s.color }]}>{s.pct}</Text>
              <Text style={styles.pipeLabel}>{s.label}</Text>
              <Text style={[styles.pipeVal, { color: s.color }]}>{formatMoney(s.val, true)}</Text>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  insightRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 6, marginRight: 10, flexShrink: 0 },
  insightText: { color: colors.text, fontSize: 13, flex: 1, lineHeight: 20 },
  incomeTotal: { color: colors.green, fontSize: 20, fontWeight: '700', marginBottom: 10 },
  pipeRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  pipePct:     { fontWeight: '700', width: 40 },
  pipeLabel:   { color: colors.text, flex: 1, marginLeft: 8 },
  pipeVal:     { fontWeight: '600' },
});
