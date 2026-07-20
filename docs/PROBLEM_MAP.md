# WeProduce — Problem Map

*The founding document. Everything we build should trace back to a problem on this page.*

## The one-sentence problem

On large productions (film sets, large-scale YouTube shoots, live events), the information needed to run the crew — who's on it, where they are, where they sleep, how they got there, and what they need to know right now — is scattered across spreadsheets, email threads, group texts, and booking sites, and no single person can see the whole picture.

## Who feels the pain

| Role | What they need | What they have today |
|---|---|---|
| Executive Producer | Live rollup: is everything on track? Where's the risk? What's it costing? | Calls and texts to coordinators; stale spreadsheets |
| Line Producer / UPM | Budget reality vs. plan, especially travel & lodging burn | Manual reconciliation across sheets and receipts |
| Production Coordinator | One place to manage crew data, travel, hotels, and changes | 6–12 spreadsheets, airline sites, hotel emails, PDFs |
| Department Heads (camera, audio, G&E, art, catering…) | Their team's roster, arrivals, and schedule | Forwarded emails and word of mouth |
| Crew member | "Where do I need to be, when, where am I sleeping — and did I get paid right?" | Digging through texts and email for a confirmation number |
| Payroll Accountant | Clean timecards, rates, and start paperwork per person per day | Chasing paper timecards and reconciling against a stale crew sheet |

## The core problems

### 1. Fragmented sources of truth (the "site-to-site, sheet-to-sheet" problem)
Crew list in Google Sheets. Flights in airline confirmation emails. Hotel blocks in another sheet. Call sheets as PDF attachments. Comms split across text, WhatsApp, Slack, and email. Nothing links together, so answering a simple question ("has the B-cam operator landed, and which hotel is she in?") means opening five tools.

### 2. Crew rosters don't scale in spreadsheets
Hundreds of crew across dozens of departments: full-run vs. day players, contact info, emergency contacts, dietary restrictions, union/paperwork status, onboarding state. Spreadsheets break down here in predictable ways:
- Version chaos (`CrewList_FINAL_v3_ACTUAL.xlsx`)
- No change history — nobody knows who edited what or when
- All-or-nothing access — you can't show a department head only their department
- One person becomes the human API for the whole sheet

### 3. Travel & lodging logistics are a full-time mess
- Dozens to hundreds of flights, each a separate confirmation email
- Hotel room blocks with check-in/out dates that must line up with each person's work dates
- No live picture of who's booked, who's in transit, who's landed, who's stuck
- Unused hotel nights and duplicate bookings silently burn budget

### 4. Changes don't propagate
This is the killer. The shoot slips one day, and that single change touches flights (rebook 40 of them), hotel nights (extend or eat the cost), catering headcounts, call sheets, and per diems. Today the fan-out is entirely manual, and whatever gets missed becomes a fire on set.

### 5. Comms are broadcast into the void
Call time changes at 11pm go out as a group text. No read receipts, no confirmation, no way to message "just the camera department," no record of which version of the call sheet anyone is looking at. "I never got that" is unfalsifiable.

### 6. The EP is flying blind
There is no rollup view. Confirmation status by department, travel status, lodging occupancy, budget burn — all of it lives in other people's heads and inboxes. The EP's dashboard today is their phone's call log.

### 7. Payroll runs on data nobody keeps in one place
Paying the crew requires exactly the data that's scattered everywhere else: who worked which days, at what rate, under which deal (union scale vs. negotiated, daily vs. weekly), plus kit rentals, per diems tied to travel days, and overtime triggers (meal penalties, short turnaround, 6th/7th-day premiums). Today that means:
- Paper or spreadsheet timecards chased down every week by coordinators
- Start paperwork (deal memos, W-4/I-9, direct deposit) living in email attachments, so nobody can say who's actually cleared to work
- Per diems calculated off travel dates that live in a different sheet than the rates
- The payroll service (Entertainment Partners, Cast & Crew, Wrapbook…) receiving messy inputs and producing disputes ("I worked that Saturday")
- Labor burn — usually the biggest line item — invisible to the EP until the payroll report lands days later

## What the dashboard has to be, structurally

The problems above imply five connected pillars, all hanging off one spine:

- **The spine: the production schedule** (shoot days, locations, phases). Every other object — a person's work dates, a flight, a hotel night, a call time — attaches to it, so schedule changes can propagate instead of being manually fanned out.
- **Crew directory** — every person, their department, role, work dates, status (invited → confirmed → traveled → wrapped), and paperwork/onboarding state. Department heads see their people; coordinators see everything.
- **Travel & lodging board** — flights and hotel assignments per person, linked to their work dates, with mismatch warnings (hotel checkout before last work day, no flight for a confirmed crew member, etc.).
- **Comms hub** — announcements targeted by department or whole-crew, with read/acknowledge tracking, replacing the group-text void.
- **Payroll tracker** — each person's rate, deal type, paperwork/clearance status, worked days (driven by the schedule spine), per diems (driven by travel dates), and timecard status per pay week. Feeds clean data to the payroll service; surfaces labor burn live.
- **EP overview** — the top of the funnel: per-department confirmation %, travel status counts, lodging occupancy and orphan nights, labor burn vs. budget, open alerts. Answers "is everything on track and what is it costing?" in one screen.

Note how the spine pays off twice: "who works which days" is the same fact that drives hotel nights, catering counts, **and** payroll days. Keep it in one place and travel, meals, and paychecks stop disagreeing with each other.

## What this is not (for now)

- Not a booking engine — we track and reconcile bookings, we don't compete with airlines/agencies (v1)
- Not a payroll *processor* — we track rates, worked days, per diems, and timecard status, and hand clean data to the payroll service (EP, Cast & Crew, Wrapbook…); we don't cut checks or file taxes
- Not a replacement for scheduling software like Movie Magic — we hold the schedule spine, not stripboards
- Not a chat app — we do structured announcements with acknowledgment, not DMs (v1)

## Sharpest first slice (proposed MVP)

Crew directory + travel/lodging board + payroll tracking + EP overview, with the schedule spine underneath. That directly attacks problems 1, 2, 3, 6, and 7 — the "jumping between sites and sheets" pain that started this project, plus live labor burn. Change propagation (4) and comms (5) build naturally on top once people, dates, and rates live in one system.
