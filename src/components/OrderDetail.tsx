/* eslint-disable @typescript-eslint/no-explicit-any -- booking records are free-form JSON that varies by service and age */
import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { api, type AdminOrderDetail, type OrderService } from "../lib/api";
import { Alert, Badge, Modal, Spinner } from "./ui";
import { TicketButton } from "./TicketButton";
import { LABEL, type Tone } from "../lib/ui-styles";

/**
 * Everything stored about one booking, for debugging: summary, timeline and
 * errors, price breakup (customer and supplier), itinerary, passengers,
 * add-ons, issued references, payments, and the raw record.
 */

const inr = (n: unknown) =>
  typeof n === "number"
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(n)
    : "–";
const when = (iso: unknown) =>
  typeof iso === "string" && iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        // Booking times are Indian: never the viewer's browser zone.
        timeZone: "Asia/Kolkata",
      })
    : "–";
const text = (v: unknown) =>
  v === null || v === undefined || v === "" ? "–" : String(v);

/** Supplier-provided links are only rendered when they are plain https URLs. */
const httpsUrl = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  try {
    const url = new URL(v);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

const GROUP_TONE: Record<string, Tone> = {
  confirmed: "green",
  in_progress: "amber",
  unpaid: "slate",
  failed: "red",
  cancelled: "slate",
};

function Section({
  title,
  children,
  empty,
}: {
  title: string;
  children?: ReactNode;
  empty?: boolean;
}) {
  return (
    <section className="mb-5">
      <h3 className={`${LABEL} mb-2`}>{title}</h3>
      {empty ? (
        <p className="text-xs text-inactive">
          Not recorded for this booking (made before full booking records).
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function Grid({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="flex justify-between gap-3 border-b border-tertiary-button/60 py-1"
        >
          <dt className="text-inactive">{k}</dt>
          <dd className="text-right font-semibold break-all text-foreground">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return <p className="text-xs text-inactive">None.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-tertiary-button">
      <table className="w-full text-xs">
        <thead className="bg-background text-left text-inactive">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2.5 py-1.5 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-tertiary-button">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-2.5 py-1.5 align-top text-foreground">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function errorsOf(r: Record<string, any>): string[] {
  const out: string[] = [];
  if (r.ticketingError) out.push(`Ticketing: ${r.ticketingError}`);
  if (typeof r.error === "string") out.push(r.error);
  else if (r.error?.message)
    out.push(`${r.error.stage ?? "Error"}: ${r.error.message}`);
  return out;
}

/** Cancellation recorded on the booking (flights and hotels), with the refund due. */
function CancellationSection({ cx }: { cx: Record<string, any> | undefined }) {
  if (!cx) return null;
  return (
    <Section title="Cancellation & refund">
      <Grid
        rows={[
          ["Cancelled at", when(cx.at)],
          ["Cancellation ID", text(cx.cancellationId)],
          ...(cx.autoCancellation === undefined
            ? []
            : ([
                [
                  "Confirmed by supplier at once",
                  cx.autoCancellation ? "Yes" : "No (pending at the supplier)",
                ],
              ] as Array<[string, ReactNode]>)),
          ["Cancellation charge", typeof cx.cancellationCharge === "number" ? inr(cx.cancellationCharge) : "Not computed yet"],
          [
            "Refund due to customer",
            typeof cx.refundDue === "number" ? <span className="text-success">{inr(cx.refundDue)}</span> : "Not computed yet",
          ],
          ["Customer remarks", text(cx.remarks)],
        ]}
      />
    </Section>
  );
}

/** Whether our ticket / voucher / policy email reached the customer (timeline). */
function CommunicationSection({
  r,
  kind,
  to = r.request?.contactInfo?.email,
}: {
  r: Record<string, any>;
  kind: "TICKET" | "VOUCHER" | "POLICY";
  to?: string;
}) {
  const timeline: any[] = Array.isArray(r.timeline) ? r.timeline : [];
  const sent = [...timeline].reverse().find((t) => new RegExp(`^${kind}_EMAIL`).test(t.event));
  const label = kind === "TICKET" ? "E-ticket" : kind === "VOUCHER" ? "Voucher" : "Policy";
  return (
    <Section title="Customer communication">
      <Grid
        rows={[
          [`${label} sent to`, text(to)],
          [
            `${label} email`,
            sent
              ? sent.event === `${kind}_EMAILED`
                ? `Sent · ${when(sent.at)}`
                : `Failed · ${when(sent.at)} · ${text(sent.detail)}`
              : "Not sent (booking not confirmed)",
          ],
        ]}
      />
    </Section>
  );
}

function FlightSections({ r }: { r: Record<string, any> }) {
  const it = r.itinerary ?? {};
  const req = r.request ?? {};
  const p = r.pricing ?? {};
  const bz = r.benzy ?? {};
  const ticketPax: any[] = r.ticket?.passengers ?? [];
  return (
    <>
      <Section title="Booking references" empty={!bz.transactionId}>
        <Grid
          rows={[
            ["Airline PNR", text(bz.pnr)],
            ["Benzy transaction", text(bz.transactionId)],
            ["Benzy booking status", text(bz.bookingStatus)],
            ["Outcome", text(bz.outcome)],
            ["StartPay code", text(bz.startPayCode)],
            [
              "Benzy net (priced / itinerary / paid)",
              `${inr(bz.pricedNetAmount)} / ${inr(bz.itineraryNetAmount)} / ${inr(bz.startPayNetAmount)}`,
            ],
            ["Add-ons priced", inr(bz.pricedSsrAmount)],
            ["Benzy gross", inr(bz.supplierGrossAmount)],
            ["Itinerary TUI", <span className="font-mono text-[11px]">{text(bz.itineraryTui)}</span>],
          ]}
        />
      </Section>
      <CancellationSection cx={r.cancellation} />
      <CommunicationSection r={r} kind="TICKET" />
      <Section title="Price breakup" empty={!r.pricing}>
        <Grid
          rows={[
            [
              "Fare (customer, incl. commission)",
              inr(p.fareTotal ?? p.customerTotal),
            ],
            [
              "Add-ons (seats, meals, baggage)",
              inr(p.addOnsTotal ?? p.ssrTotal),
            ],
            [
              "Coupon",
              p.promoCode ? `${p.promoCode} (−${inr(p.discountAmount)})` : "–",
            ],
            ["Charged to customer", inr(p.amount)],
            ["Commission", inr(p.commission)],
            [
              "Benzy gross / net",
              `${inr(p.supplierGross)} / ${inr(p.supplierNet)}`,
            ],
          ]}
        />
        {Array.isArray(it.fareBreakdown) && (
          <div className="mt-2">
            <Table
              head={["Fare line (per passenger)", "Adult", "Child", "Infant"]}
              rows={it.fareBreakdown.map((l: any) => [
                l.label,
                inr(l.adultAmount),
                inr(l.childAmount),
                inr(l.infantAmount),
              ])}
            />
          </div>
        )}
      </Section>
      <Section title="Itinerary" empty={!Array.isArray(it.segments)}>
        <Table
          head={[
            "Flight",
            "From → To",
            "Departs",
            "Arrives",
            "Cabin / class",
            "Baggage",
          ]}
          rows={(it.segments ?? []).map((s: any) => [
            `${s.airline ?? ""} ${s.airlineCode ? `${s.airlineCode}-` : ""}${s.flightNo}`,
            `${s.from} → ${s.to}${s.departureTerminal ? ` (T${s.departureTerminal})` : ""}`,
            when(s.departureTime),
            when(s.arrivalTime),
            `${text(s.cabin)} / ${text(s.fareClass || s.rbd)}`,
            text(s.baggage),
          ])}
        />
      </Section>
      <Section title="Passengers">
        <Table
          head={[
            "Name",
            "Type",
            "DOB",
            "Nationality",
            "Passport",
            "Ticket no.",
          ]}
          rows={(req.travellers ?? []).map((t: any, i: number) => [
            `${t.title} ${t.firstName} ${t.lastName}`,
            t.paxType,
            text(t.dob),
            text(t.nationality),
            text(t.passportNo),
            text(ticketPax[i]?.ticketNumber),
          ])}
        />
      </Section>
      <Section title="Seats & add-ons" empty={!Array.isArray(r.addOns)}>
        <Table
          head={["Passenger", "Flight", "Item", "Charge"]}
          rows={(r.addOns ?? []).map((a: any) => [
            a.passenger,
            a.flight,
            `${a.item}${a.type && a.type !== "seat" ? ` (${a.type})` : ""}`,
            inr(a.charge),
          ])}
        />
      </Section>
    </>
  );
}

function HotelSections({ r }: { r: Record<string, any> }) {
  const it = r.itinerary ?? {};
  const fb = it.fareBreakdown ?? {};
  const p = r.pricing ?? {};
  const v = r.response ?? {};
  const bz = r.benzy ?? {};
  const cx = r.cancellation;
  const req = r.request ?? {};
  const reqRooms: any[] = req.rooms ?? [];
  const vRooms: any[] = v.rooms ?? [];
  const guestsCount = reqRooms.reduce((s, x) => s + (x.guests?.length ?? 0), 0);
  // Suppliers repeat address parts ("Goa,403512, ., Goa, Goa"): keep each once.
  const parts = v.hotel?.address
    ? [v.hotel.address.line1, v.hotel.address.line2, v.hotel.address.city, v.hotel.address.state, v.hotel.address.zip]
        .flatMap((x: unknown) => String(x ?? "").split(","))
        .map((x: string) => x.trim())
        .filter((x: string) => x && x !== ".")
    : [];
  const address =
    [...new Map(parts.map((x: string) => [x.toLowerCase(), x])).values()].join(", ") ||
    it.hotel?.fullAddress ||
    it.hotel?.address;
  return (
    <>
      <Section title="Stay" empty={!it.room && !v.hotel && !req.hotelCode}>
        <Grid
          rows={[
            ["Hotel", text(v.hotel?.name ?? it.hotel?.name)],
            ["Address", text(address)],
            ["Hotel phone", text(v.hotel?.phone)],
            [
              "Check-in",
              `${text(v.checkInDate?.slice?.(0, 10) ?? req.checkInDate)}${v.checkInTime ? `, from ${v.checkInTime}` : ""}`,
            ],
            [
              "Check-out",
              `${text(v.checkOutDate?.slice?.(0, 10) ?? req.checkOutDate)}${v.checkOutTime ? `, until ${v.checkOutTime}` : ""}`,
            ],
            ["Nights", text(v.nights)],
            [
              "Rooms / guests",
              `${reqRooms.length || vRooms.length} room(s), ${guestsCount || "–"} guest(s)`,
            ],
            ["Room type", text(it.room?.name ?? vRooms[0]?.name)],
            ["Meal plan", text(it.room?.boardBasis)],
            ["Inclusions", text((it.room?.inclusions ?? []).join(", "))],
            ["Refundable", it.room ? (it.room.refundable ? "Yes" : "No") : "–"],
            ["Free cancellation until", when(it.room?.freeCancellationUntil ?? v.freeCancellationUntil)],
            ["Special request", text(req.specialRequest)],
            ["GST", req.contactInfo?.gstTin ? `${req.contactInfo.gstTin} · ${text(req.contactInfo.gstCompanyName)}` : "–"],
          ]}
        />
      </Section>
      <Section title="Rooms & guests" empty={!reqRooms.length}>
        <Table
          head={["Room", "Room type", "Guest", "Type", "PAN", "Supplier conf."]}
          rows={reqRooms.flatMap((room: any, i: number) =>
            (room.guests ?? []).map((g: any, j: number) => [
              j === 0 ? `Room ${i + 1}` : "",
              j === 0 ? text(vRooms[i]?.name ?? it.room?.name) : "",
              `${g.title} ${g.firstName} ${g.lastName}`,
              g.paxType === "C" ? `Child${g.age ? ` (${g.age} yrs)` : ""}` : "Adult",
              text(g.pan),
              j === 0 ? text(vRooms[i]?.supplierConfirmationNumber) : "",
            ]),
          )}
        />
      </Section>
      <Section title="Booking references" empty={!bz.transactionId && !v.transactionId}>
        <Grid
          rows={[
            ["Hotel confirmation no.", text(v.confirmationId)],
            ["Benzy transaction", text(bz.transactionId ?? v.transactionId)],
            ["Benzy booking status", text(bz.status)],
            ["StartPay status", text(bz.startPayStatus ?? bz.startPayError)],
            [
              "Benzy net (booked / priced)",
              `${inr(bz.netAmount)} / ${inr(bz.pricedNet)}`,
            ],
            ["Benzy TUI", <span className="font-mono text-[11px]">{text(bz.tui)}</span>],
          ]}
        />
      </Section>
      <CancellationSection cx={cx} />
      <CommunicationSection r={r} kind="VOUCHER" />

      <Section title="Price breakup">
        <Grid
          rows={[
            ["Charged to customer", inr(p.amount ?? v.totalAmount)],
            ["Commission", inr(p.commission)],
            ["Benzy total", inr(p.supplierTotal ?? r.supplier?.netAmount)],
            ["Base rate (customer)", inr(fb.baseRate)],
            ["TCS", inr(fb.tcsOnTotal)],
          ]}
        />
        {Array.isArray(fb.taxes) && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Table
              head={["Tax", "Amount"]}
              rows={fb.taxes.map((t: any) => [
                text(t.description),
                inr(t.amount),
              ])}
            />
            <Table
              head={["Room", "Customer total"]}
              rows={(fb.perRoomRates ?? []).map((x: any, i: number) => [
                `Room ${i + 1}`,
                inr(x.totalRate),
              ])}
            />
          </div>
        )}
      </Section>
    </>
  );
}

function InsuranceSections({ r }: { r: Record<string, any> }) {
  const plan = r.plan ?? {};
  const p = r.pricing ?? {};
  const ins = r.premium?.insurer;
  return (
    <>
      <Section title="Price breakup">
        <Grid
          rows={[
            ["Charged to customer", inr(p.amount)],
            ["Insurer premium", inr(p.benzyAmount)],
            [
              "Commission",
              typeof p.amount === "number" && typeof p.benzyAmount === "number"
                ? inr(p.amount - p.benzyAmount)
                : "–",
            ],
            [
              "Insurer base / tax",
              ins ? `${inr(ins.base)} / ${inr(ins.tax)}` : "–",
            ],
          ]}
        />
        {Array.isArray(r.premium?.customer?.perTraveller) && (
          <div className="mt-2">
            <Table
              head={["Traveller", "Customer price"]}
              rows={r.premium.customer.perTraveller.map((t: any, i: number) => [
                text(t.relation ?? `Traveller ${i + 1}`),
                inr(t.price ?? t.amount ?? t),
              ])}
            />
          </div>
        )}
      </Section>
      <Section title="Policy">
        <Grid
          rows={[
            ["Plan", text(plan.planName)],
            ["Insurer", text(plan.providerLabel ?? plan.provider)],
            [
              "Coverage",
              plan.coverage
                ? `${plan.coverage.currency ?? ""} ${plan.coverage.amount ?? ""}`
                : "–",
            ],
            ["Destinations", text(plan.countryNames?.join?.(", "))],
            [
              "Insurer status / code",
              `${text(r.result?.status)} / ${text(r.result?.code)}`,
            ],
            // ProcessInsuranceItineraryListing status: B0 = issued (the only "confirmed").
            ["Benzy itinerary status", text(r.result?.itineraryStatus)],
            ["Transaction ID", text(r.result?.transactionId)],
            ["Confirmation", text(r.result?.confirmationNumber)],
          ]}
        />
      </Section>
      <Section title="Travellers & policies">
        <Table
          head={["Name", "DOB", "Relation", "Nominee", "Passport"]}
          rows={(r.request?.travellers ?? []).map((t: any) => [
            `${t.title ?? ""} ${t.firstName} ${t.lastName}`,
            text(t.birthDate),
            text(t.relation),
            t.nominee
              ? `${t.nominee.firstName} ${t.nominee.lastName} (${t.nominee.relation ?? ""})`
              : "–",
            text(t.passportNo ?? t.passportNumber),
          ])}
        />
        {Array.isArray(r.result?.vouchers) && (
          <div className="mt-2">
            <Table
              head={["Policy no.", "Status", "Document"]}
              rows={r.result.vouchers.map((v: any) => [
                text(v.policyNumber),
                text(v.status),
                httpsUrl(v.documentUrl) ? (
                  <a
                    href={httpsUrl(v.documentUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-links hover:underline"
                  >
                    Open
                  </a>
                ) : (
                  "–"
                ),
              ])}
            />
          </div>
        )}
      </Section>
      <CommunicationSection r={r} kind="POLICY" to={r.request?.contact?.email} />
    </>
  );
}

export function OrderDetailModal({
  service,
  bookingId,
  onClose,
}: {
  service: OrderService;
  bookingId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getOrderDetail(service, bookingId)
      .then((d) => !cancelled && setData(d))
      .catch(
        (e) =>
          !cancelled &&
          setError(
            e instanceof Error ? e.message : "Could not load the booking",
          ),
      );
    return () => {
      cancelled = true;
    };
  }, [service, bookingId]);

  const r = data?.record ?? {};
  const b = data?.booking;
  const errors = data ? errorsOf(r) : [];
  const timeline: any[] = Array.isArray(r.timeline) ? r.timeline : [];

  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal
      wide
      title={<span className="font-mono text-base">{bookingId}</span>}
      onClose={onClose}
      footer={
        data ? (
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-button px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy full record (JSON)"}
          </button>
        ) : undefined
      }
    >
      {error && <Alert tone="error">{error}</Alert>}
      {!data && !error && <Spinner label="Loading booking…" />}
      {data && b && (
        <div data-testid="order-detail">
          <Section title="Summary">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={GROUP_TONE[data.statusGroup] ?? "slate"} dot>
                {data.statusGroup.replace("_", " ")}
              </Badge>
              <span className="font-mono text-xs text-inactive">
                status: {b.status}
              </span>
              {data.ticketAvailable && (
                <span className="ml-auto">
                  <TicketButton service={data.service} bookingId={b.bookingId} size="md" />
                </span>
              )}
            </div>
            <Grid
              rows={[
                ["Booked", when(b.createdAt)],
                [
                  "Customer",
                  `${b.user.name} (${b.user.role === "AGENT" ? "partner" : "customer"})`,
                ],
                ["Account email", b.user.email],
                [
                  "Booking contact",
                  `${text(b.contactEmail)}${b.contactMobile ? ` / ${b.contactMobile}` : ""}`,
                ],
                [
                  data.statusGroup === "unpaid" ? "Amount (not paid)" : "Paid",
                  inr(b.totalAmount),
                ],
                [
                  "Commission",
                  b.commissionAmount === null
                    ? "not recorded"
                    : `${inr(b.commissionAmount)} (${b.commissionAudience})`,
                ],
                [
                  "Reference",
                  text(b.pnr ?? b.confirmationId ?? b.policyNumber),
                ],
                ["Benzy transaction", text(b.transactionId)],
              ]}
            />
          </Section>

          {errors.length > 0 && (
            <div className="mb-5">
              <Alert tone="error">{errors.join(" · ")}</Alert>
            </div>
          )}

          <Section title="Timeline" empty={!timeline.length}>
            <ol className="space-y-1.5 border-l-2 border-tertiary-button pl-3 text-xs">
              {timeline.map((t, i) => (
                <li key={i}>
                  <span className="text-inactive">{when(t.at)}</span> ·{" "}
                  <strong className="text-foreground">{t.event}</strong>
                  {t.detail ? (
                    <span className="text-foreground"> — {t.detail}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </Section>

          {data.service === "FLIGHT" && <FlightSections r={r} />}
          {data.service === "HOTEL" && <HotelSections r={r} />}
          {data.service === "INSURANCE" && <InsuranceSections r={r} />}

          <Section title="Payments">
            <Table
              head={[
                "Gateway ref",
                "Status",
                "Amount",
                "Mode",
                "Bank txn",
                "Response",
                "Started",
                "Paid",
              ]}
              rows={data.payments.map((p) => [
                <span className="font-mono">{p.merchantTxnNo}</span>,
                p.status,
                inr(p.amount),
                text(p.paymentMode),
                text(p.txnId),
                `${text(p.responseCode)} ${p.respDescription ?? ""}`.trim(),
                when(p.createdAt),
                when(p.paidAt),
              ])}
            />
          </Section>

          <details className="rounded-lg border border-tertiary-button">
            <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-foreground">
              Raw record (JSON)
            </summary>
            <pre className="max-h-80 overflow-auto bg-background p-3 text-[11px] leading-relaxed text-foreground">
              {JSON.stringify(data.record, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </Modal>
  );
}
