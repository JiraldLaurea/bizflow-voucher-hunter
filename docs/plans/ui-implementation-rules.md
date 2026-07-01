# UI Implementation Rules

- Public campaign flow uses `/campaign/[slug]` and preserves the 8-step journey from the reference UI.
- Users must see date/time availability before a hunt can start.
- Candidate cards must display benefits without exposing internal pool IDs.
- Admin dashboard should prioritize dense, scannable metrics and operational tables.
- Staff validation must show customer, slot, voucher status, and redemption action in one screen.
- CSS variables in `src/app/globals.css` are the design-token source for this MVP.
- Layouts must remain usable on mobile; tables may scroll horizontally.
