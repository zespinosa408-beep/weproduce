# WeProduce

One dashboard for running large production crews — people, travel, hotels, payroll and comms in a single place, hanging off the production schedule instead of scattered across spreadsheets.

## What's here

- **[`docs/PROBLEM_MAP.md`](docs/PROBLEM_MAP.md)** — the founding document: the problems this tool exists to solve, who feels them, and the proposed MVP slice.
- **[`prototype/index.html`](prototype/index.html)** — a self-contained clickable prototype (no build, no dependencies — open it in a browser). It simulates a 152-person commercial shoot ("Echo Mesa", Albuquerque) mid-production, with six views: EP Overview, Crew, Travel, Lodging, Payroll, and the Schedule spine. Every alert on the Overview is derived from the data, not hand-written — including a "schedule slips one day" simulator that shows the booking fallout of a single date change.

## Also in this repo

- **[`un-mensaje-para-ti/`](un-mensaje-para-ti/)** — a separate project, unrelated to the dashboard: a consent-based service for sending short messages of encouragement to people who sign up for them. Includes a rollout plan, a message library, privacy and crisis-response rules, and a zero-dependency tool for running the manual phase.

## The core idea

The production schedule is the spine. A crew member's work dates, their flights, their hotel nights, and their pay days all attach to it. That's what lets the tool *derive* problems (hotel ends before wrap, confirmed crew with no flight, orphan room nights, missing timecards) instead of waiting for someone to notice them across six spreadsheets.
