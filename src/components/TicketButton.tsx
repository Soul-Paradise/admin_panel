import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { api, type OrderService } from "../lib/api";

/**
 * Downloads the customer's ticket for a booking with one click: the flight
 * e-ticket or the hotel voucher - the same PDF the customer received.
 */
export function TicketButton({
  service,
  bookingId,
  size = "sm",
}: {
  service: OrderService;
  bookingId: string;
  size?: "sm" | "md";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = service === "HOTEL" ? "Voucher" : "E-ticket";

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.downloadOrderTicket(service, bookingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        title={`Download the customer's ${label.toLowerCase()} (PDF)`}
        data-testid="ticket-download"
        className={
          size === "md"
            ? "inline-flex items-center gap-1.5 rounded-full bg-primary-button px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            : "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-links ring-1 ring-tertiary-button hover:bg-primary-tint/50 disabled:opacity-60"
        }
      >
        {busy ? (
          <Loader2 className={size === "md" ? "h-4 w-4 animate-spin" : "h-3.5 w-3.5 animate-spin"} />
        ) : (
          <Download className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        )}
        {size === "md" ? `Download ${label.toLowerCase()}` : label}
      </button>
      {error && <span className="mt-1 max-w-[220px] text-right text-[11px] text-danger">{error}</span>}
    </span>
  );
}
