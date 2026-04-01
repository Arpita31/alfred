import { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { FinanceVM } from '../../hooks/useFinance';
import { Asset, Liability } from '../../types/finance';
import { Card } from '../common/Card';
import { SectionLabel } from '../common/SectionLabel';
import { ListItem } from '../common/ListItem';
import { GhostButton } from '../common/GhostButton';
import { ButtonRow } from '../common/ButtonRow';
import { StyledInput } from '../common/StyledInput';
import { colors } from '../../theme/colors';
import { formatMoney } from '../../lib/ml/finance';
import { LAYER_META } from '../../constants/options';
import { AssetLayer } from '../../types/finance';

type Props = Pick<FinanceVM,
  'finance' | 'netWorth' | 'netWorthFmt' |
  'addAsset' | 'removeAsset' | 'addLiability' | 'removeLiability'
>;

const EMPTY_ASSET  = { name: '', value: '' };
const EMPTY_LIAB   = { name: '', balance: '', rate: '' };

export function BalanceTab({ finance, netWorth, netWorthFmt, addAsset, removeAsset, addLiability, removeLiability }: Props) {
  const [assetForm,   setAssetForm]  = useState<{ name: string; value: string; layer?: AssetLayer } | null>(null);
  const [liabForm,    setLiabForm]   = useState<typeof EMPTY_LIAB | null>(null);

  const totalAssets = finance.assets.reduce((s, a) => s + a.value, 0);
  const totalLiabs  = finance.liabilities.reduce((s, l) => s + l.balance, 0);

  const submitAsset = async () => {
    if (!assetForm?.name || !assetForm.value) return;
    await addAsset({ name: assetForm.name, value: parseFloat(assetForm.value) || 0, type: 'other', layer: assetForm.layer ?? 3 });
    setAssetForm(null);
  };

  const submitLiab = async () => {
    if (!liabForm?.name || !liabForm.balance) return;
    await addLiability({ name: liabForm.name, balance: parseFloat(liabForm.balance) || 0, rate: parseFloat(liabForm.rate) || 0 });
    setLiabForm(null);
  };

  return (
    <View>
      {/* Net Worth summary */}
      <Card>
        <SectionLabel label="net worth" />
        <Text style={[styles.bigNum, { color: netWorth >= 0 ? colors.green : colors.red }]}>{netWorthFmt}</Text>
        <View style={styles.assetLiabRow}>
          <Text style={styles.meta}>Assets <Text style={{ color: colors.green }}>{formatMoney(totalAssets, true)}</Text></Text>
          <Text style={styles.meta}>Liabilities <Text style={{ color: colors.red }}>−{formatMoney(totalLiabs, true)}</Text></Text>
        </View>
      </Card>

      {/* Layered assets */}
      {LAYER_META.map(layer => {
        const assets = finance.assets.filter((a: Asset) => a.layer === layer.n);
        const total  = assets.reduce((s: number, a: Asset) => s + a.value, 0);
        return (
          <Card key={layer.n}>
            <View style={styles.layerHeader}>
              <View>
                <Text style={[styles.layerTitle, { color: layer.color }]}>Layer {layer.n} · {layer.label}</Text>
                <Text style={styles.layerSub}>{layer.sub}</Text>
              </View>
              <Text style={[styles.layerTotal, { color: layer.color }]}>{formatMoney(total, true)}</Text>
            </View>
            {assets.map((a: Asset) => (
              <ListItem key={a.id} primary={a.name} value={formatMoney(a.value, true)} valueColor={colors.text} onDelete={() => removeAsset(a.id)} />
            ))}
            <GhostButton label={`+ Layer ${layer.n}`} onPress={() => setAssetForm({ ...EMPTY_ASSET, layer: layer.n })} color={layer.color} style={styles.addBtn} />
          </Card>
        );
      })}

      {/* Add asset inline form */}
      {assetForm && (
        <Card>
          <SectionLabel label="new asset" />
          <StyledInput placeholder="Name" value={assetForm.name} onChangeText={v => setAssetForm(f => f ? { ...f, name: v } : f)} />
          <StyledInput placeholder="Value ($)" value={assetForm.value} onChangeText={v => setAssetForm(f => f ? { ...f, value: v } : f)} keyboardType="numeric" />
          <ButtonRow actions={[
            { label: 'Add Asset', onPress: submitAsset, color: colors.green },
            { label: 'Cancel',    onPress: () => setAssetForm(null), ghost: true },
          ]} />
        </Card>
      )}

      {/* Liabilities */}
      <Card>
        <View style={styles.layerHeader}>
          <Text style={[styles.layerTitle, { color: colors.red }]}>Liabilities</Text>
          <Text style={[styles.layerTotal, { color: colors.red }]}>−{formatMoney(totalLiabs, true)}</Text>
        </View>
        {finance.liabilities.map((l: Liability) => (
          <ListItem key={l.id} primary={l.name} secondary={`${l.rate}% APR`} value={formatMoney(l.balance, true)} valueColor={colors.red} onDelete={() => removeLiability(l.id)} />
        ))}
        <GhostButton label="+ Add Liability" onPress={() => setLiabForm(EMPTY_LIAB)} color={colors.red} style={styles.addBtn} />
      </Card>

      {liabForm && (
        <Card>
          <SectionLabel label="new liability" />
          <StyledInput placeholder="Name (e.g. Car loan)" value={liabForm.name} onChangeText={v => setLiabForm(f => f ? { ...f, name: v } : f)} />
          <View style={styles.row}>
            <StyledInput style={styles.flex} placeholder="Balance ($)" value={liabForm.balance} onChangeText={v => setLiabForm(f => f ? { ...f, balance: v } : f)} keyboardType="numeric" />
            <StyledInput style={styles.flex} placeholder="APR %" value={liabForm.rate} onChangeText={v => setLiabForm(f => f ? { ...f, rate: v } : f)} keyboardType="decimal-pad" />
          </View>
          <ButtonRow actions={[
            { label: 'Add', onPress: submitLiab, color: colors.red },
            { label: 'Cancel', onPress: () => setLiabForm(null), ghost: true },
          ]} />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bigNum:       { fontSize: 32, fontWeight: '800', marginBottom: 6 },
  assetLiabRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta:         { color: colors.muted, fontSize: 12 },
  layerHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  layerTitle:   { fontWeight: '700', fontSize: 14 },
  layerSub:     { color: colors.muted, fontSize: 11, marginTop: 2 },
  layerTotal:   { fontWeight: '700', fontSize: 15 },
  addBtn:       { marginTop: 8 },
  row:          { flexDirection: 'row', gap: 8 },
  flex:         { flex: 1 },
});
