# Atomic Voucher RC v0.9 — Controlled staging and production release

**NO-GO pending a verified staging backup rehearsal.** The release work starts from integration merge `a7049a1` (PR #98), which includes `213fef6` (PR #97). The staging operator reports a verified legacy marker, exact 0016–0019 rows, and an empty checkpoint. This release has not accessed either server.

## Migration decision

The default runner continues to require canonical history. The explicit staging mode accepts exactly the documented `baseline-manual-through-0015` marker followed by repository-verified `0016–0019`, optionally followed by the single frozen `0020` row on retry. It requires the existing InnoDB journal/checkpoint and an empty checkpoint. It verifies the pre-0020 runtime schema contract before starting. Known 0020 additions are separated using the signatures observed on a freshly migrated 0019 MySQL 8.0.46 schema. Incompatible existing 0020 columns, missing required schema, changed reviewed files, extra history, or future migrations are stop conditions. Post-DDL parity must pass before the runner can record 0020. If DDL partially commits, the checkpoint survives. The five legacy rows remain unchanged.

Use a disposable MySQL 8.0.46 clone with loopback-only port, isolated network, no provider access, and schema name `onetone_rc_clone_<id>`. Restore an approved encrypted staging snapshot after verifying the backup SHA-256, source identity, checkpoint, DDL/dump completeness, and restore procedure. Load `DATABASE_URL` for the isolated clone through the operator's secret store. With this reviewed code:

```bash
APP_ENV=staging ./node_modules/.bin/tsx scripts/migrate-mysql.ts --legacy-clone-baseline
APP_ENV=staging ./node_modules/.bin/tsx scripts/migrate-mysql.ts --legacy-clone-baseline
```

Require `previous: 20, applied: 1` then `previous: 21, applied: 0`, PASS for schema parity, six journal records with the original five byte-for-byte intact, and an empty checkpoint. The `previous` counts represent effective migration positions. Confirm the preserved original rows by ID/hash/time. Compare source/clone counts and deterministic private digests over customer, orders/items, voucher/grants, invoices/attempts, points, inventory and affiliate payout/commission data. Include seed/backfill effects and domain invariants from the [v1.1 reconciliation runbook](./staging-migration-reconciliation-v11.md). Record matching data and approved exceptions with the release SHA, backup hash, and restore timestamp. If a real clone differs, use the canonical side-by-side rebuild/data transfer path in that runbook after a reviewed explicit mapping. Preserve the original source.

## Staging release

1. Review the PR and require CI for the exact approved tree. Check the GitHub `staging` environment is restricted to `main`, has required reviewers with prevention of self-review, and has approval acknowledgment variable `STAGING_RELEASE_APPROVAL_CONFIGURED=true`. A push to `main` builds images. A push to `release/atomic-voucher-*` runs CI and publishes separately tagged RC images. Neither push deploys.
2. Save the signed-off backup/rehearsal evidence at `/opt/onetone-store/release-evidence/<release SHA>.staging-rehearsal`. Save old app digest, Compose, and environment files privately before the window. After approval, dispatch Build & Deploy on `main` with `staging_only_confirm`, the SHA-256 of the evidence file, and `legacy_baseline_confirm` only for the proven staging baseline. The staging job verifies the evidence before invoking the migration, confirms target identity, checks TEST key formats, and pulls the exact image pair from the workflow build. Record image digests, OCI revision, and run link. Preserve the current app and file backups if any guard fails.
3. Run the guarded staging preflight with the deployed revision and app digest. Confirm Xendit TEST account and webhook delivery in the dashboard. The app ships with voucher OFF. A separate operator-approved window may opt into the sandbox order, payment ledger and voucher flags with isolated TEST accounts/fixtures. Live shipping and payments remain disabled. Use the [full v0.9 UAT matrix](./atomic-voucher-release-candidate-v09.md#checklist-uat-staging) and record outcomes below.
4. Stop on mismatch or any UAT failure. Turn off the temporary voucher opt-in and reconcile TEST invoices before rolling back the app. Use the saved prior digest/Compose and config after checking schema compatibility in clone. If DDL partially committed, preserve checkpoint and evidence. Recover only using the tested restore plan after inventorying post-backup writes.

| Staging Xendit TEST UAT | Required evidence | Actual |
| --- | --- | --- |
| Eligible checkout and retry | One order, invoice, and grant reservation; changed voucher/points retry rejected with 409 | UNVERIFIED |
| PAID and duplicate PAID | Correct ownership; voucher and stock effects exactly once | UNVERIFIED |
| EXPIRED and trusted cancellation | Authoritative provider evidence; voucher release and points refund of actual debit once | UNVERIFIED |
| Replay, out-of-order and concurrent settlement | Terminal decisions preserved, ambiguous cases enter reconciliation | UNVERIFIED |
| Schema/inventory/points and database rollback | Whole settlement rolls back on injected failure; data invariants hold | UNVERIFIED |
| Failure and recovery | Unverified provider evidence fails closed; pending invoices reconciled without a second invoice | UNVERIFIED |

## Future production release

1. **Approval prerequisites.** First review and land the workflow change so production push cannot deploy. Configure the GitHub `production` environment with required independent reviewers, prevention of self-review, branch restriction to `production`, and disable administrator bypass where supported. Set `PRODUCTION_RELEASE_APPROVAL_CONFIGURED=true` only in that protected environment after verifying the rules. Provision its SSH credentials and pinned host fingerprint there. The workflow does not provision or verify GitHub protection settings itself.
2. **Build and pin.** Dispatch Build & Deploy on `production` with `production_build_only=true`, staging confirmation OFF. This builds artifacts only. Capture the build summary with digests from both Buildx steps. Each digest must have the release SHA in `org.opencontainers.image.revision` and its corresponding OCI title (`onetone-app` or `onetone-migrator`). The production workflow pulls those immutable references and verifies the metadata before proceeding.
3. **Backup, proof and DB preflight.** Rehearse the production backup restore privately on an isolated clone and verify checksum, RPO/RTO, integrity and old-app/schema compatibility. Store the approved encrypted backup and rehearsal report on the protected host at `/opt/apps/onetone-store/release-evidence/<SHA>.backup.enc` and `<SHA>.rehearsal`. The report includes staging UAT and restore evidence. Create `<SHA>.approved` as five newline-terminated values in order: release SHA, app digest, migrator digest, backup SHA-256, rehearsal SHA-256. Keep the receipt and evidence directory outside the deploy account's write permissions. Provision a separate writable `release-overrides` directory for digest overlays. Supply `.production-preflight.env` via the approved host procedure with `APP_ENV=production` and `PRODUCTION_PREFLIGHT_DATABASE_URL` for the dedicated SELECT-only account `onetone_release_readonly` targeting `onetone-db:3306/onetone_db`. Use access adequate to inspect runtime metadata; do not give this account DDL/DML privileges. The preflight binds to the verified production container address on the existing Compose network, reads a complete canonical journal plus checkpoint/parity in a read-only transaction, and emits redacted status. If the schema is pending, legacy, or unverified, stop. A production DB migration would require a separately reviewed and explicitly approved procedure. The workflow performs no migration.
4. **Separate deployment approval.** Dispatch *Approve and deploy a production release* on `production` only after the preceding gates. Submit both digests and both evidence hashes. The GitHub environment review gates the job. It checks the files and runs the pinned migrator image as a read-only preflight, then recreates only the app using the digest overlay. Retain the overlay for restart and rollback. Production provider configuration stays under the existing operator-controlled configuration.
5. **Smoke tests and rollback.** Confirm running image ID/revision, health, homepage, catalog, product detail, existing auth flow and checkout page via read-only checks. Review redacted error rate, payment/webhook observations and pending reconciliation without making any real payment or shipment. Stop or roll back the app to the last approved digest/overlay if smoke tests fail. Keep database recovery separate and approved. Use restore only after the operator reconciles writes after the snapshot.

## Evidence gates

| Gate | Status |
| --- | --- |
| Integration ancestry | PASS verified locally from the remote ref |
| Synthetic MySQL 8.0.46 backup and restored clone | PASS checksum, 0020 once, rerun no-op, parity, representative order and invoice rows preserved, empty checkpoint |
| Staging backup, real restored clone and operator clearance | UNVERIFIED |
| Exact release GitHub CI and registry artifacts | UNVERIFIED |
| Staging deploy and TEST UAT | UNVERIFIED |
| Production required reviewers, live preflight, backup/restore and approval | UNVERIFIED |

The next operator action is to authorize and supply a verified staging backup via a restricted channel for the exact clone rehearsal.
