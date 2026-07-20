# WeProduce — Integration Strategy

*How we deal with the fact that every production books travel, rooms, and people through different systems — and why we never try to replace those systems.*

## The reality on the ground

A production's bookings live in systems we don't control and mostly can't API into:

- **Flights**: booked directly on airline sites, through a corporate travel agent, or through a platform (Navan, TravelPerk, Concur). Airlines themselves offer no useful public booking APIs. The artifact that always exists: **a confirmation email**.
- **Hotels**: room blocks negotiated by phone and email with a sales manager. There is no API for "the 40-room block Maria negotiated at the Sawmill." The artifact that always exists: **a confirmation email or an attached PDF/spreadsheet**.
- **HRIS / payroll**: Wrapbook, Entertainment Partners, Cast & Crew, ADP, Workday, Gusto — fragmented, but this category *does* have real APIs, plus unified-API vendors (Merge, Finch) that wrap dozens of HRIS systems behind one integration.
- **A production is a temporary company.** It stands up in weeks and dissolves at wrap. Nobody is doing an IT integration project for a 6-week shoot. Whatever we build must work on day one with zero setup.

## The strategy: be the hub, never the replacement

WeProduce is the layer *above* their systems — the single place that knows what's booked, whether it still lines up with the schedule, and where to go to change it. Data flows **in** through three lanes that work with literally any system, plus upgrade lanes where real APIs exist. Navigation flows **out** through deep links, so nobody hunts through tabs.

### Lane 1 — The magic inbox (works with every system, day one)

Every production gets an address like `echomesa@in.weproduce.app`. Forward any confirmation — airline, hotel, car, travel agent itinerary — and we parse it (AI extraction is extremely good at confirmation emails now): traveler name, confirmation number, flight/hotel, dates. The parser matches it to a crew member and attaches it to the schedule spine. Unmatched items land in a review queue, never silently dropped.

This is the highest-leverage feature in the product. It's how TripIt won personal travel, and it means our answer to "do you integrate with X?" is **yes** on day one, for every X that sends email.

### Lane 2 — Universal spreadsheet import

Productions already have crew lists, travel grids, and room lists in Sheets/Excel. A column-mapping importer ("this column is names, this one is check-out dates") pulls existing state in during onboarding instead of asking anyone to re-type 150 rows. This is also the migration path off the spreadsheets — meet them where they are.

### Lane 3 — Fast manual entry

A coordinator on the phone with a hotel sales manager needs a 10-second way to record "extended room 214 through the 20th." Manual entry is not a fallback; it's a first-class lane, optimized for speed.

### Upgrade lane A — Live status without integration

**Flight tracking needs no airline relationship.** Given airline + flight number (which the parsed confirmation already gives us), public flight-status APIs (FlightAware, AviationStack, etc.) provide live landed/in-air/delayed status. The "who has landed?" board on the Travel view comes for free once bookings are in.

### Upgrade lane B — Unified HRIS/payroll APIs

One integration with a unified-API vendor (Merge or Finch) covers dozens of HRIS systems: roster, start-paperwork status, and worker records sync automatically for productions that use a supported system. Entertainment-specific payroll services (Wrapbook has a real API; EP/Cast & Crew via exports) get targeted connectors later, prioritized by customer demand — and until then, timecard/paperwork state flows through Lanes 2 and 3 like everything else.

### Upgrade lane C — Booking APIs (much later)

Duffel/Amadeus-class APIs make booking flights *from inside* WeProduce possible eventually. This is deliberately last: it's the most work, the most liability, and the least differentiated. Tracking and reconciliation is the wedge; booking is a v3 luxury.

## The navigation contract (what "with ease" means in the UI)

1. **Every record shows its source.** A flight row says "Delta · conf #HKX9PL · via travel agent email, Aug 4" — you always know which system owns it.
2. **One click out.** Each record deep-links to where it can be acted on: airline manage-booking page pre-filled with the confirmation number, the HRIS worker record, the hotel's email thread. WeProduce is the map; their systems stay the territory.
3. **The dashboard is the system of belief, not the system of booking.** We record what we believe is true and continuously reconcile it against the schedule spine. When belief and schedule disagree, that's an alert. When belief and reality disagree (a voided ticket we never heard about), the fix is one forward to the magic inbox.
4. **Nobody below the coordinator ever touches the source systems.** Department heads and the EP get everything — status, itineraries, who's landed — from WeProduce. The 12 browser tabs become one.

## Sequencing

| Phase | Ships | Covers |
|---|---|---|
| v1 | Magic inbox + spreadsheet import + fast manual entry + flight-status API + source links | 100% of productions, any systems |
| v2 | Unified HRIS API (Merge/Finch), travel-platform feeds (Navan/TravelPerk/Concur exports), per-person travel file export | Productions on modern systems get zero-touch sync |
| v3 | Entertainment payroll connectors (Wrapbook first), in-app booking via Duffel-class APIs | Deep workflow ownership |
