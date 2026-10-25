import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, CircleAlert, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { apiError } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { AuthLayout } from '../components/layout'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function MobileBrand() {
  return (
    <div className="mobile-brand brand">
      <div className="brand-mark"><Sparkles size={17} /></div>
      <span>Schedulr</span>
    </div>
  )
}

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (cause) {
      setError(apiError(cause, 'Invalid email or password.'))
    } finally {
      setLoading(false)
    }
  }

  const googleError = new URLSearchParams(location.search).has('error')
  const googleUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/auth/google/`

  return (
    <AuthLayout>
      <div className="auth-card">
        <MobileBrand />
        <p className="eyebrow">WELCOME BACK</p>
        <h2>Sign in to your workspace</h2>
        <p className="muted">Manage schedules and monitor every run from one place.</p>
        {(googleError || error) && (
          <div className="alert error">
            <CircleAlert size={17} />
            {error || 'Google sign-in could not be completed. Please try again.'}
          </div>
        )}
        <form onSubmit={submit}>
          <Field label="Email">
            <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          </Field>
          <Field label="Password">
            <div className="password-input">
              <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" />
              <button type="button" onClick={() => setShowPassword(value => !value)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
          <button disabled={loading} className="button primary wide">
            {loading ? 'Signing in…' : 'Sign in'} {!loading && <ArrowRight size={17} />}
          </button>
        </form>
        <div className="divider"><span>or</span></div>
        <a className="button google wide" href={googleUrl}>
          <span className="google-g">G</span> Continue with Google
        </a>
        <p className="auth-footer">New to Schedulr? <Link to="/register">Create an account</Link></p>
      </div>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const { isAuthenticated, register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setLoading(true)
    try {
      await register(email, password, confirm)
      setSuccess(true)
    } catch (cause) {
      setError(apiError(cause, 'Please check your registration details.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <MobileBrand />
        <p className="eyebrow">GET STARTED</p>
        <h2>Create your account</h2>
        <p className="muted">Set up your workspace and start scheduling in minutes.</p>
        {success ? (
          <div className="success-panel">
            <div className="success-icon"><Check /></div>
            <h3>Account created</h3>
            <p className="muted">Your account is ready. Sign in to continue.</p>
            <button className="button primary wide" onClick={() => navigate('/login')}>
              Go to sign in <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <>
            <div className="security-note"><ShieldCheck size={17} /> Your credentials are secured by the backend.</div>
            {error && <div className="alert error"><CircleAlert size={17} /> {error}</div>}
            <form onSubmit={submit}>
              <Field label="Email">
                <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
              </Field>
              <Field label="Password">
                <div className="password-input">
                  <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
                  <button type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
              </Field>
              <Field label="Confirm password">
                <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat your password" />
              </Field>
              <button disabled={loading} className="button primary wide">
                {loading ? 'Creating account…' : 'Create account'} {!loading && <ArrowRight size={17} />}
              </button>
            </form>
          </>
        )}
        <p className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </AuthLayout>
  )
}

export function CallbackPage() {
  const { exchangeGoogleCode } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true
    const code = new URLSearchParams(window.location.search).get('code')
    console.log("Google OAuth Callback Code:", code) // Log the code for debugging

    window.history.replaceState({}, '', '/oauth/callback')
    if (!code) {
      queueMicrotask(() => setError('The Google login code is missing.'))
      return
    }
    exchangeGoogleCode(code)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(cause => setError(apiError(cause, 'This Google login code is invalid or expired.')))
  }, [exchangeGoogleCode, navigate])

  return (
    <AuthLayout>
      <div className="auth-card callback-card">
        {error ? (
          <>
            <div className="success-icon danger"><X /></div>
            <h2>Could not sign you in</h2>
            <p className="muted">{error}</p>
            <Link className="button primary wide" to="/login">Return to sign in</Link>
          </>
        ) : (
          <>
            <div className="spinner" />
            <h2>Finishing sign in…</h2>
            <p className="muted">Verifying your Google account securely.</p>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
