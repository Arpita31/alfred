import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  children: ReactNode;
  /** Label shown in the fallback UI, e.g. the screen name. */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary][${this.props.label ?? 'unknown'}]`, error, info);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.icon}>⚠</Text>
        <Text style={styles.title}>{this.props.label ?? 'Something went wrong'}</Text>
        <Text style={styles.message} numberOfLines={3}>{this.state.message}</Text>
        <TouchableOpacity style={styles.btn} onPress={this.reset}>
          <Text style={styles.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon:    { fontSize: 40, marginBottom: 12 },
  title:   { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message: { color: colors.muted, fontSize: 13, textAlign: 'center', marginBottom: 24 },
  btn:     { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  btnText: { color: colors.bg, fontWeight: '700', fontSize: 14 },
});
