import { StyleSheet } from 'react-native';
import C from './colors';

const shared = StyleSheet.create({
  card: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: C.muted,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  sub: {
    fontSize: 13,
    color: C.muted,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
  },
  btn: {
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  btnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnGhostText: {
    color: C.muted,
    fontSize: 13,
  },
  input: {
    backgroundColor: C.surface3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    fontSize: 14,
  },
  chip: {
    backgroundColor: C.surface3,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: C.bg,
    padding: 16,
  },
});

export default shared;
