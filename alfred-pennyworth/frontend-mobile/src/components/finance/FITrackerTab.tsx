import { View, Text, StyleSheet } from 'react-native';
import { FinanceVM } from '../../hooks/useFinance';
import { Card } from '../common/Card';
import { SectionLabel } from '../common/SectionLabel';
import { ProgressBar } from '../common/ProgressBar';
import { colors } from '../../theme/colors';
import { formatMoney } from '../../lib/ml/finance';

type Props = Pick<FinanceVM,
  'netWorth' | 'fiNumber' | 'yearsToFI' | 'monthlyExpenses' | 'monthlyIncome'
>;

const PHASES = [
  { n: 1, label: 'Foundation',   milestone: '3mo runway',      targetFn: (exp: number, fi: number) => exp * 3    },
  { n: 2, label: 'Stability',    milestone: '6mo + debt-free', targetFn: (exp: number, fi: number) => exp * 6    },
  { n: 3, label: 'Growth',       milestone: 'FI 25%',          targetFn: (exp: number, fi: number) => fi * 0.25  },
  { n: 4, label: 'Acceleration', milestone: 'FI 50%',          targetFn: (exp: number, fi: number) => fi * 0.5   },
  { n: 5, label: 'Freedom',      milestone: 'FI 100%',         targetFn: (exp: number, fi: number) => fi         },
];

export function FITrackerTab({ netWorth, fiNumber, yearsToFI, monthlyExpenses, monthlyIncome }: Props) {
  const cashFlow   = monthlyIncome - monthlyExpenses;
  const fiProgress = fiNumber > 0 ? Math.min(100, Math.round((Math.max(0, netWorth) / fiNumber) * 100)) : 0;
  const targetYear = new Date().getFullYear() + Math.ceil(yearsToFI);

  return (
    <View>
      {/* FI Number */}
      <Card>
        <SectionLabel label="fi number (4% rule)" />
        <Text style={styles.fiNum}>{fiNumber > 0 ? formatMoney(fiNumber, true) : '—'}</Text>
        <Text style={styles.fiSub}>
          {monthlyExpenses > 0
            ? `${formatMoney(monthlyExpenses, true)}/mo × 12 × 25`
            : 'Add monthly expenses to calculate'}
        </Text>
        {fiNumber > 0 && (
          <>
            <ProgressBar pct={fiProgress} color={colors.accent} height={10} />
            <View style={styles.progressMeta}>
              <Text style={styles.hint}>{fiProgress}% there</Text>
              <Text style={styles.hint}>{formatMoney(fiNumber, true)}</Text>
            </View>
          </>
        )}
      </Card>

      {/* Years to FI */}
      {yearsToFI < 999 && (
        <Card>
          <View style={styles.yearsRow}>
            <Text style={styles.yearsNum}>{yearsToFI}</Text>
            <View>
              <Text style={styles.yearsLabel}>YEARS TO FI</Text>
              <Text style={styles.yearsMeta}>Investing {formatMoney(cashFlow, true)}/mo · 8% return</Text>
              <Text style={[styles.yearsMeta, { color: colors.accent, fontWeight: '600' }]}>Target: {targetYear}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Phase roadmap */}
      <Card>
        <SectionLabel label="phase roadmap" />
        {PHASES.map(p => {
          const target  = p.targetFn(monthlyExpenses, fiNumber);
          const reached = netWorth >= target && target > 0;
          return (
            <View key={p.n} style={styles.phaseRow}>
              <View style={[styles.phaseNum, reached && styles.phaseNumDone]}>
                <Text style={[styles.phaseNumText, reached && { color: colors.green }]}>{p.n}</Text>
              </View>
              <View style={styles.phaseInfo}>
                <View style={styles.phaseHeader}>
                  <Text style={styles.phaseLabel}>{p.label}</Text>
                  <Text style={styles.phaseMilestone}>{p.milestone}</Text>
                </View>
                <Text style={styles.phaseTarget}>
                  {target > 0 ? `Target: ${formatMoney(target, true)}` : 'Set expenses to unlock'}
                </Text>
              </View>
              {reached && <Text style={styles.check}>✓</Text>}
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={styles.formula}>
          Wealth = (Income − Expenses) × Return × Time × Discipline
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  fiNum:        { fontSize: 34, fontWeight: '800', color: colors.accent, marginBottom: 4 },
  fiSub:        { color: colors.muted, fontSize: 12, marginBottom: 10 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  hint:         { color: colors.muted, fontSize: 12 },
  yearsRow:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
  yearsNum:     { fontSize: 52, fontWeight: '800', color: colors.text },
  yearsLabel:   { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  yearsMeta:    { color: colors.text, fontSize: 13, marginTop: 3 },
  phaseRow:     { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  phaseNum:     { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  phaseNumDone: { borderColor: colors.green },
  phaseNumText: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  phaseInfo:    { flex: 1 },
  phaseHeader:  { flexDirection: 'row', justifyContent: 'space-between' },
  phaseLabel:   { color: colors.text, fontWeight: '600', fontSize: 13 },
  phaseMilestone: { color: colors.accent, fontSize: 11 },
  phaseTarget:  { color: colors.muted, fontSize: 11, marginTop: 2 },
  check:        { color: colors.green, fontSize: 16, marginLeft: 8 },
  formula:      { color: colors.accent, fontWeight: '700', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
