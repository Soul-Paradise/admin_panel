import { useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { FIELD_LABEL, INPUT } from '../lib/ui-styles';
import { useSiteImages } from '../hooks/useSiteImages';
import BrandLogo from '../components/BrandLogo';

/**
 * Same two-pane layout as the customer site's AuthLayout: photo on the left
 * from lg up, and a floating white card on soft blue / orange glows.
 */
export default function Login() {
  const { login, error, isSigningIn, clearError } = useAuth();
  const loginImage = useSiteImages().images?.admin?.login ?? null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await login(email.trim(), password);
  };

  return (
    // dvh rather than vh: on mobile 100vh includes the address bar.
    <div className="flex min-h-dvh bg-background">
      {/* Left pane: the site plays a video here; a still keeps the admin light. */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-3">
        {loginImage ? (
          <>
            <img src={loginImage} alt="" className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-black/35" aria-hidden="true" />
          </>
        ) : (
          // No photo chosen in Site Content > Site-wide images: plain navy panel.
          <div className="absolute inset-0 bg-gradient-to-br from-ink-soft to-ink" aria-hidden="true">
            <span className="absolute -top-24 -left-16 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
            <span className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-orange-500/15 blur-3xl" />
          </div>
        )}
        <div className="absolute top-6 left-8 z-10">
          <BrandLogo className="h-16 w-auto" />
        </div>
      </div>

      <div className="relative flex-2 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <span className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl" />
          <span className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-orange-400/10 blur-3xl" />
        </div>

        <div className="absolute top-3 left-4 z-10 sm:top-4 sm:left-6 lg:hidden">
          <BrandLogo className="h-12 w-auto" tone="dark" />
        </div>

        <div className="relative flex min-h-dvh items-center justify-center px-4 pt-16 pb-6 sm:px-8 lg:py-6">
          <div className="animate-fade-up w-full max-w-[460px] rounded-2xl bg-peace px-6 py-6 shadow-xl ring-1 ring-tertiary-button sm:px-7">
            <div className="mb-5">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-links">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin panel
              </p>
              <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-foreground xl:text-3xl">Welcome back!</h1>
              <p className="mt-1 text-sm text-inactive">Sign in to manage bookings, partners and content.</p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="flex-1 leading-relaxed">{error}</span>
                <button
                  type="button"
                  onClick={clearError}
                  aria-label="Dismiss error"
                  className="-m-1 shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="email" className={FIELD_LABEL}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={isSigningIn}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT}
                  placeholder="you@soulparadise.com"
                />
              </div>

              <div>
                <label htmlFor="password" className={FIELD_LABEL}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    disabled={isSigningIn}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${INPUT} pr-11`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-inactive transition-colors duration-200 hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={1.75} /> : <Eye className="h-5 w-5" strokeWidth={1.75} />}
                  </button>
                </div>
              </div>

              {/* Same button as the site's "Log in with Email". */}
              <button
                type="submit"
                disabled={isSigningIn}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-primary-button px-4 py-2.5 text-sm font-semibold text-peace shadow-sm transition-colors duration-200 hover:bg-secondary-button disabled:cursor-not-allowed disabled:bg-inactive"
              >
                {isSigningIn && <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} />}
                {isSigningIn ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="mt-5 border-t border-tertiary-button pt-4 text-center text-xs text-inactive">
              Restricted access - administrators only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
