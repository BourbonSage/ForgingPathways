## Goal
Make the demo flow real: a usable Task Board with claimable Lowcountry Food Bank tasks, a visible Forge Credits balance in the header, and a simple My Progress section backed by real data.

## 1. Database (one migration)

Add two tables so claims and credits are real (not hardcoded):

- **tasks** — seedable catalog of opportunities
  - title, description, credits, location, duration, org (default "Lowcountry Food Bank"), active
  - RLS: any authenticated user can read; only admins can insert/update/delete

- **task_claims** — a user claiming/completing a task
  - user_id, task_id, status (`claimed` | `verified`), claimed_at, verified_at
  - Unique on (user_id, task_id) so the same task isn't double-claimed
  - RLS: users see/insert their own; admins see all and can update status to `verified`

- **Trigger**: on `task_claims` insert with status `claimed`, increment `profiles.credits` by the task's credit value. (Keeps balance authoritative server-side. We can later move credit-award to verification — for the demo, claiming awards credits immediately.)

- **Seed** 8 realistic tasks:
  1. Pack 50 Meal Kits — 10 PC
  2. Sort Fresh Produce — 8 PC
  3. Box Donations for Distribution — 7 PC
  4. Kitchen Support Shift — 12 PC
  5. Pack Weekend Backpacks for Kids — 9 PC
  6. Stock the Mobile Pantry Truck — 8 PC
  7. Greet & Check-In Visitors — 5 PC
  8. Inventory & Date-Check Canned Goods — 6 PC

## 2. Task Board (`src/pages/Tasks.tsx`)

Replace the hardcoded swipe deck with a clean scrollable list of task cards loaded from the `tasks` table.

Each card shows: title, short description, location/duration, credit badge, **Claim** button.

After clicking **Claim**:
- Insert a `task_claims` row (status `claimed`)
- Open a small verification dialog with a placeholder QR code (static SVG) and a "Check in at the Food Bank" message + "Done" button
- Card flips to a "Claimed ✓" state and the button disables
- Toast: "Claimed! +N Forge Credits"

Already-claimed tasks render in the claimed state on load.

## 3. Header credits badge

In `src/components/layout/AppShell.tsx`, add a compact Forge Credits pill in the header (between the logo and the admin/logout icons). It reads `profiles.credits` for the signed-in user and refreshes when claims happen.

Implementation: a small `useCredits()` hook that subscribes to realtime changes on the user's `profiles` row, so the header and Home page both update instantly after a claim.

## 4. My Progress section

Rewrite `src/pages/Progress.tsx` to use real data only for these three stats (everything else stays as today's visual layout, just unhooked from fake numbers):

- **Total credits earned** — from `profiles.credits`
- **Tasks completed this week** — count of `task_claims` for this user where `claimed_at >= start of current week`
- **Streak (weeks)** — consecutive ISO weeks (ending this week) that contain at least one claim. Computed client-side from the user's claim history.

Recent activity list pulls the user's last 5 claims joined with task title/org.

## 5. Naming

Use "Forge Credits" in user-facing copy where the user asked for it (header pill, claim toast). Keep "Pathway Credits" elsewhere it already appears (Home balance card, Rewards) so we don't sprawl the rename — confirm after the demo whether to unify.

## Technical notes

- New files: `supabase/migrations/<ts>_tasks_and_claims.sql`, `src/hooks/useCredits.ts`, `src/components/ClaimDialog.tsx`
- Edited: `src/pages/Tasks.tsx`, `src/pages/Progress.tsx`, `src/components/layout/AppShell.tsx`, `src/pages/Home.tsx` (use `useCredits` so it stays in sync)
- No changes to auth, routing, Rewards, or Admin
- QR placeholder = inline SVG, no new dependency
