/** Full-page spinner used while auth/access is still resolving (the site's loader ring). */
export default function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background" role="status" aria-live="polite">
      <img src="/logo.png" alt="Soul Paradise" className="h-14 w-auto" />
      <span className="relative flex h-10 w-10">
        <span className="absolute inset-0 rounded-full border-4 border-primary-tint" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-links" />
      </span>
      <p className="text-sm font-semibold text-inactive">{label}</p>
    </div>
  );
}
