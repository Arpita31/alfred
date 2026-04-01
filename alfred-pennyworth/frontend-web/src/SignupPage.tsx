import { useState, FormEvent } from 'react';
import { register } from './api';

interface Props {
  onSuccess: (userId: number) => void;
  onSwitchToLogin: () => void;
}

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

interface Touched {
  username: boolean;
  email: boolean;
  password: boolean;
  confirm: boolean;
}

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(u: string, e: string, p: string, c: string): FieldErrors {
  const errs: FieldErrors = {};

  if (!u.trim())
    errs.username = 'Username is required';
  else if (u.trim().length < 3)
    errs.username = 'Must be at least 3 characters';
  else if (!USERNAME_RE.test(u.trim()))
    errs.username = 'Only letters, numbers and underscores';

  if (!e.trim())
    errs.email = 'Email is required';
  else if (!EMAIL_RE.test(e.trim()))
    errs.email = 'Enter a valid email address';

  if (!p)
    errs.password = 'Password is required';
  else if (p.length < 8)
    errs.password = 'Must be at least 8 characters';

  if (!c)
    errs.confirm = 'Please confirm your password';
  else if (p && c !== p)
    errs.confirm = 'Passwords do not match';

  return errs;
}

/** Returns { score 0-4, label, color } */
function passwordStrength(p: string) {
  if (!p) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (p.length >= 8)  score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p))   score++;
  if (/[^a-zA-Z0-9]/.test(p)) score++;
  score = Math.min(score, 4);
  const map = [
    { label: 'Too weak',  color: '#f85149' },
    { label: 'Weak',      color: '#f97316' },
    { label: 'Fair',      color: '#c9a84c' },
    { label: 'Strong',    color: '#3fb950' },
    { label: 'Very strong', color: '#3fb950' },
  ];
  return { score, ...map[score] };
}

export default function SignupPage({ onSuccess, onSwitchToLogin }: Props) {
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [touched,  setTouched]  = useState<Touched>({ username: false, email: false, password: false, confirm: false });
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);

  const errors  = validate(username, email, password, confirm);
  const isValid = Object.keys(errors).length === 0;
  const strength = passwordStrength(password);

  const touch = (field: keyof Touched) =>
    setTouched(t => ({ ...t, [field]: true }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, email: true, password: true, confirm: true });
    if (!isValid) return;

    setLoading(true);
    setApiError('');
    try {
      const data = await register({ username: username.trim(), email: email.trim(), password });
      onSuccess(data.user_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      console.error('[SignupPage] register error:', err);
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: keyof FieldErrors): React.CSSProperties => ({
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
        <p style={styles.tagline}>Create your account to get started</p>

        <form onSubmit={handleSubmit} style={styles.form} noValidate>

          {/* Username */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Username</label>
            <input
              style={inputStyle('username')}
              type="text"
              placeholder="letters, numbers, underscores"
              autoComplete="username"
              value={username}
              onChange={e => { setUsername(e.target.value); setApiError(''); }}
              onBlur={() => touch('username')}
              disabled={loading}
            />
            {touched.username && errors.username &&
              <span style={styles.fieldError}>{errors.username}</span>}
          </div>

          {/* Email */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email</label>
            <input
              style={inputStyle('email')}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setApiError(''); }}
              onBlur={() => touch('email')}
              disabled={loading}
            />
            {touched.email && errors.email &&
              <span style={styles.fieldError}>{errors.email}</span>}
          </div>

          {/* Password + strength */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={inputStyle('password')}
              type="password"
              placeholder="at least 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setApiError(''); }}
              onBlur={() => touch('password')}
              disabled={loading}
            />
            {password && (
              <div style={styles.strengthWrap}>
                <div style={styles.strengthTrack}>
                  {[1,2,3,4].map(i => (
                    <div
                      key={i}
                      style={{
                        ...styles.strengthSeg,
                        background: i <= strength.score ? strength.color : 'var(--border)',
                      }}
                    />
                  ))}
                </div>
                <span style={{ ...styles.strengthLabel, color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
            {touched.password && errors.password &&
              <span style={styles.fieldError}>{errors.password}</span>}
          </div>

          {/* Confirm password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Confirm password</label>
            <input
              style={inputStyle('confirm')}
              type="password"
              placeholder="repeat your password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setApiError(''); }}
              onBlur={() => touch('confirm')}
              disabled={loading}
            />
            {touched.confirm && errors.confirm &&
              <span style={styles.fieldError}>{errors.confirm}</span>}
            {touched.confirm && !errors.confirm && confirm &&
              <span style={{ ...styles.fieldError, color: '#3fb950' }}>✓ Passwords match</span>}
          </div>

          {/* API error */}
          {apiError && <p style={styles.apiError}>{apiError}</p>}

          <button
            type="submit"
            style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create account →'}
          </button>
        </form>

        <p style={styles.switchText}>
          Already have an account?{' '}
          <button style={styles.switchLink} onClick={onSwitchToLogin}>Sign in</button>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' },
  card:       { width: '100%', maxWidth: '400px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
  logo:       { fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '2px' },
  tagline:    { color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '12px' },
  form:       { width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label:      { color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
  input: {
    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '11px 14px', color: 'var(--text)',
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  },
  fieldError:    { color: '#f85149', fontSize: '0.78rem' },
  apiError:      { color: '#f85149', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '6px', padding: '8px 12px' },
  strengthWrap:  { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' },
  strengthTrack: { display: 'flex', gap: '4px', flex: 1 },
  strengthSeg:   { height: '3px', flex: 1, borderRadius: '2px', transition: 'background 0.2s' },
  strengthLabel: { fontSize: '0.72rem', fontWeight: 600, minWidth: '60px', textAlign: 'right' },
  btn:           { width: '100%', background: 'var(--accent)', color: '#0a0e14', border: 'none', borderRadius: '8px', padding: '13px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', marginTop: '6px' },
  switchText:    { marginTop: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' },
  switchLink:    { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', padding: 0 },
};
