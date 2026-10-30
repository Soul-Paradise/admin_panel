/** Toggle switch (same look as the Policies "Published" switch). */
export default function Switch({
  checked,
  onChange,
  label,
  disabled,
  title,
  showLabel = true,
  onLabel = 'On',
  offLabel = 'Off',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name. */
  label: string;
  disabled?: boolean;
  /** Tooltip, e.g. why it is disabled. */
  title?: string;
  showLabel?: boolean;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <label className={`inline-flex items-center gap-2.5 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`} title={title}>
      {showLabel && <span className="text-sm font-semibold text-foreground">{checked ? onLabel : offLabel}</span>}
      <span className="relative inline-flex">
        <input
          type="checkbox"
          role="switch"
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="peer h-6 w-11 rounded-full bg-tertiary-button transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-peace after:shadow-sm after:transition-all after:content-[''] peer-checked:bg-success peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-links/30" />
      </span>
    </label>
  );
}
