# Talent Bridging Scheduling

Talent Bridging is a scheduling app for prospective candidates and hiring teams. It uses the existing TanStack Start, Prisma, PostgreSQL, and Better Auth stack.

## Features

- Visitors can choose active appointment types, view eligible dates and times, book with contact details, and see a confirmation and booking reference.
- Visitors can find, cancel, and reschedule a booking by matching its reference and email address.
- The availability engine applies configured business timezone, weekly working days and split hours, special date blocks or overrides, minimum notice, maximum booking window, daily limit, appointment duration, and buffer time.
- PostgreSQL persists bookings and configuration. Booking creation and rescheduling recheck conflicts inside date-scoped advisory-lock transactions.
- Better Auth protects the admin route and server functions. Admin access is restricted to a signed-in account matching `ADMIN_EMAIL`.
- The admin dashboard shows current booking counts, upcoming meetings, searchable and sortable booking records, date/type/status filters, pagination, and cancellation.
- Admins can change booking policies and timezone, weekly working-day availability and hours, add or remove holiday exceptions, create and edit appointment types, deactivate or delete types safely, and review booking trends.
- Confirmation, cancellation, and rescheduling notices are explicitly simulated. The app does not send email.

## Setup

1. Install dependencies with Node.js 22 or newer: `npm install`.
2. Set `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`, and optionally `ADMIN_NAME` in `.env.local`. Use the Supabase transaction pooler URL (port `6543`) for `DATABASE_URL` at runtime and the session pooler URL (port `5432`) or direct URL for `DIRECT_URL` so Prisma schema pushes do not run through transaction pooling. Copy both URLs from the Supabase Connect dialog and keep their host and project reference aligned.
3. Apply the schema and generate Prisma Client:

   ```bash
   npm run db:push
   npm run db:generate
   ```

4. Create the first admin account:

   ```bash
   npm run admin:create
   ```

   Remove `ADMIN_INITIAL_PASSWORD` after setup. Admin sign-up is disabled in the app; use an operator-managed account for access.
5. Start the app with `npm run dev` and open `http://localhost:3000`.

## Deploying to Vercel

In the Vercel project settings, add the production `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and `ADMIN_EMAIL` environment variables. Set `BETTER_AUTH_URL` to the deployed site's origin (for example, `https://your-project.vercel.app`) and keep `BETTER_AUTH_SECRET` stable across deployments so existing sessions remain valid. `ADMIN_EMAIL` must exactly match the email address of the administrator account in that same database; sign-in can succeed while the app still denies the admin route if this variable is missing or points to a different account. Apply the variables to the Production environment and redeploy.

Configure Preview environment variables separately if you use Vercel preview deployments.

## Sample data and limitations

Appointment types and weekday hours are created automatically when the app first accesses scheduling data. Existing confirmed appointments are preserved when settings change. Email delivery, a full week/day admin calendar, admin-side booking edits and rescheduling, custom analytics date ranges, and throttling for visitor lookup are future work. Visitor cancellation and rescheduling require both the booking reference and matching email.

The schema is pushed directly for local setup; production deployments should use reviewed Prisma migrations. Check your database provider's connection mode before relying on transaction locks in production.

## AI disclosure

This codebase was developed with AI assistance. Future work should add operational email delivery, a full week/day admin calendar, admin-side booking edits, automated integration tests against a provisioned database, and production migration review.
