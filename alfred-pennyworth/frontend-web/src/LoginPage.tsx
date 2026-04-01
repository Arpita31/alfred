import { useState, FormEvent } from 'react';
import { login } from './api';

interface Props {
  onSuccess: (userId: number) => void;
  onSwitchToSignup: () => void;
}

interface FieldErrors { username?: string; password?: string }
interface Touched     { username: boolean; password: boolean }

function validateLogin(username: string, password: string): FieldErrors {
  const errs: FieldErrors = {};
  if (!username.trim())
    errs.username = 'Username or email is required';
  if (!password)
    errs.password = 'Password is required';
  return errs;
}

export default function LoginPage({ onSuccess, onSwitchToSignup }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [touched,  setTouched]  = useState<Touched>({ username: false, password: false });
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);

  const errors  = validateLogin(username, password);
  const isValid = Object.keys(errors).length === 0;

  const touch = (field: keyof Touched) =>
    setTouched(t => ({ ...t, [field]: true }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Touch all fields to show any hidden errors
    setTouched({ username: true, password: true });
    if (!isValid) return;

    setLoading(true);
    setApiError('');
    try {
      const data = await login({ username: username.trim(), password });
      onSuccess(data.user_id);
    } catch (err: unknown) {
      console.error('[LoginPage] login error:', err);
      setApiError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: keyof FieldErrors) => ({
    ...styles.input,
    borderColor: touched[field] && errors[field]
      ? '#f85149'
      : touched[field] && !errors[field]
        ? '#3fb950'
        : 'var(--border)',
  });

  return (
    <div style={styles.screen}>
      <div style={styles.card}>
        <div style={styles.logo}>Alfred</div>
        <p style={styles.tagline}>Your personal health &amp; wealth assistant</p>

        <form onSubmit={handleSubmit} style={styles.form} noValidate>

          {/* Username / Email */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Username or email</label>
            <input
              style={inputStyle('username')}
              type="text"
              placeholder="Enter your username or email"
              autoComplete="username"
              value={username}
              onChange={e => { setUsername(e.target.value); setApiError(''); }}
              onBlur={() => touch('username')}
              disabled={loading}
            />
            {touched.username && errors.username &&
              <span style={styles.fieldError}>{errors.username}</span>}
          </div>

          {/* Password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={inputStyle('password')}
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setApiError(''); }}
              onBlur={() => touch('password')}
              disabled={loading}
            />
            {touched.password && errors.password &&
              <span style={styles.fieldError}>{errors.password}</span>}
          </div>

          {/* API-level error (wrong credentials etc.) */}
          {apiError && <p style={styles.apiError}>{apiError}</p>}

          <button
            type="submit"
            style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <p style={styles.switchText}>
          Don't have an account?{' '}
          <button style={styles.switchLink} onClick={onSwitchToSignup}>Sign up</button>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' },
  card:       { width: '100%', maxWidth: '380px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
  logo:       { fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '2px' },
  tagline:    { color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '12px' },
  form:       { width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label:      { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
  input: {
    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '12px 14px', color: 'var(--text)',
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  },
  fieldError: { color: '#f85149', fontSize: '0.78rem' },
  apiError:   { color: '#f85149', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '6px', padding: '8px 12px' },
  btn:        { width: '100%', background: 'var(--accent)', color: '#0a0e14', border: 'none', borderRadius: '8px', padding: '13px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', marginTop: '4px' },
  switchText: { marginTop: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' },
  switchLink: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', padding: 0 },
};
