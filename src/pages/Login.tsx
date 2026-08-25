import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login, error, isLoading, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await login(email.trim(), password);
  };

  // Same field treatment as the site's FormInput component.
  const fieldClasses =
    'block w-full rounded-lg border border-gray-300 bg-peace px-3.5 py-2.5 text-sm text-gray-900 ' +
    'placeholder-gray-400 transition-all duration-200 ' +
    'focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none ' +
    'disabled:cursor-not-allowed disabled:bg-gray-100';

  return (
    /*
     * The site's login is a two-pane split: form on the left, imagery on the
     * right from lg up. dvh rather than vh — on mobile 100vh includes the
     * address bar, which pushes the form down out of view.
     */
    <div className="flex min-h-dvh bg-peace">
      <div className="relative flex flex-2 items-center justify-center overflow-y-auto bg-background px-4 py-6 lg:px-8">
        {/* Logo, positioned as on the site */}
        <div className="absolute top-3 left-3 z-20 sm:top-4 sm:left-4 lg:top-6 lg:left-6">
          <img src="/logo.png" alt="Soul Paradise" className="h-10 w-auto sm:h-12 md:h-14" />
        </div>

        <div className="w-full max-w-[420px] pt-16 sm:pt-20 lg:pt-8">
          <div className="mb-6">
            <p className="text-3xl font-bold tracking-tight text-foreground">Admin Panel</p>
            <p className="mt-2 text-sm text-foreground">
              Sign in to manage bookings, partners and content.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <span className="flex-1 leading-relaxed">{error}</span>
              <button
                type="button"
                onClick={clearError}
                aria-label="Dismiss error"
                className="-m-1 shrink-0 rounded p-1 text-red-500 transition-colors hover:text-red-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-gray-700">
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
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClasses}
                placeholder="you@soulparadise.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${fieldClasses} pr-11`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 transition-colors duration-200 hover:text-gray-700"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.774 3.162 10.066 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-primary-button px-4 py-2.5 text-sm font-semibold text-peace shadow-sm transition-colors duration-200 hover:bg-secondary-button disabled:cursor-not-allowed disabled:bg-inactive"
            >
              {isLoading && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="pt-6 text-center text-xs text-gray-500">
            Restricted access — administrators only.
          </p>
        </div>
      </div>

      {/* Right pane: the site uses a looping video here. A still keeps the admin
          bundle light while matching the same imagery. */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-3">
        <img src="/hero_bg.jpg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-foreground/45" />
        <div className="absolute right-0 bottom-0 left-0 p-10 text-peace">
          <p className="text-2xl font-bold tracking-tight">Soul Paradise Travels</p>
          <p className="mt-1 text-sm font-semibold opacity-90">Your Pocket Friendly Tour Planner</p>
        </div>
      </div>
    </div>
  );
}
