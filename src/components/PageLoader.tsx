import { LoaderCircle } from 'lucide-react';

/** Full-page spinner used while auth/access is still resolving. */
export default function PageLoader({ label = 'Loading\u2026' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <img src="/logo.png" alt="Soul Paradise" className="h-12 w-auto" />
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} />
        {label}
      </div>
    </div>
  );
}
