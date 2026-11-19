# OneTone — Durable Payment Attempt Ledger v0.1

**Status:** Draft PR, schema/state policy only. **No Xendit request or production checkout is enabled.**

## Why this exists

The owner successfully verified staging checkout preflight anonymous `HTTP 401`, but the authenticated UAT is blocked on an unavailable customer TEST login. Backend hardening can proceed independently; authentication must still pass before any staged end-to-end approval.

The existing legacy API/web checkout can leave orders and stock committed even when an invoice fails. Sandbox mitigates repeat calls by returning 202 after an ambiguous invoice outcome, but a durable payment-attempt record is necessary to survive server restarts, provider timeouts and concurrent requests.

## Schema

Versioned migration `0019_checkout_payment_attempts.sql` and Drizzle `checkoutPaymentAttempts` table:

- `order_id` FK + `attempt_no` unique per order: every attempt has an immutable durable identity, never overwritten by a new attempt
- `mode` ('sandbox' or 'live'): test and live attempts must be isolated
- unique `external_id` for provider identity; unique nullable `xendit_id` once known
- immutable request evidence to be enforced by caller: `request_hash`, `amount`
- status: `reserved`, `requesting`, `needs_reconciliation`, `ready`, `paid`, `expired`, `failed`
- timestamps, error code and provider URL for controlled reconciliation
- amount and attempt sequence DB constraints; no backfill of old invoice data

This is an **additive migration**. The only caller in this PR is a pure state-policy test and a dedicated isolated MySQL integration test. No API endpoint queries/writes the table yet.

## Provider state policy

1. A new attempt must be inserted **before** the provider call, with a reserved state, a request hash and an immutable external ID.
2. A concurrent worker can begin Xendit creation only by atomically claiming a reserved attempt (conditional UPDATE status + affectedRows check). *Not implemented in this PR.*
3. If a request times out or the process crashes while requesting, state is unknown and **must not** trigger a blind second Xendit POST.
4. Reconcile by a trusted provider lookup and/or signed webhook. A confirmed non-created invoice may move to failed, but this is not assumed from timeout.
5. A READY invoice may be marked paid/expired only based on authenticated provider evidence and one-time stock/order state transitions.
6. Terminal outcomes must not regress to a new provider request. Repay requires explicit business decisions and a **new** attempt number; never reuse an ambiguous reference.

`lib/checkout/payment-attempt-policy.ts` expresses the allowed state transitions but **does not persist them**. Future callers must enforce concurrency with DB transactions and conditional updates. This PR does not yet prove exactly-once payment effects.

## UAT and go-live blockers

- Staging login must be resolved with a valid customer TEST. Never send passwords or Bearer tokens to ChatGPT/GitHub logs.
- Validate HTTP 200 owned cart/address/fresh rate/preflight and tampered quote HTTP 409; check order/invoice/stock unchanged; turn preflight flag OFF after UAT.
- Add a staging-only durable attempt reservation/claim/reconciliation service with concurrency tests, then wire **Xendit TEST only**. No provider calls in database transactions.
- Review voucher, points, affiliates, membership and web Server Action parity before replacing existing live checkout routes.
- Test webhook PAID/EXPIRED races, customer cancel/repay, stock refund/release and Biteship before owner signoff.

## Tests and rollback

- Pure state machine tests prevent re-request after `requesting`, `needs_reconciliation` and final provider states.
- Dedicated MySQL 8 tests confirm unique order+attempt, external ID, Xendit ID, and positive values. They create and destroy an isolated test database; never use production data.
- On `main` merge, staging deploy will run versioned migration automatically. Back up staging first if needed. The new unused table does not change existing order/payment runtime.
- Production deploy requires a **separate controlled production-branch release**; this PR must not be promoted directly. Do not drop the table for rollback after it contains records; stop future usage and use reviewed migration strategy.

## Dependency

See [production go-live gate issue #79](https://github.com/one2pret/onetone-store/issues/79). Android production Beta checkout remains disabled.
