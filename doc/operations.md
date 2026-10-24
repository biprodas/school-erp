# Operations runbook

How the backend is run, watched, backed up and restored in production, and how pilot schools are onboarded. Backend plan M8 (section 12); PRD 8.8 and 11.5.

## 1. Monitoring and alerting

### Health

- `GET /api/health` reports `database`, `redis` (BullMQ connection `PING`) and `storage` (S3 `HeadBucket` on `S3_BUCKET`). It is the load balancer's readiness check. A `down` component returns 503.
- With `QUEUE_DRIVER=inline` there is no Redis, so `redis` always reports `up`.

### Error tracking (Sentry)

- Set `SENTRY_DSN` to turn it on. Without it error tracking is a no-op; local runs and tests don't set it.
- Optional settings:
  - `SENTRY_ENVIRONMENT`, which defaults to `NODE_ENV`.
  - `SENTRY_TRACES_SAMPLE_RATE`, from 0 to 1, default 0.
  - `APP_RELEASE`, a git sha or tag.
- What gets reported:
  - Every 5xx from `GlobalExceptionFilter`, tagged with `org_id`, `request_id` and `METHOD /path`.
  - Every job that fails its last attempt (`JobTracker`), tagged with `job <queue>:<name>`.
- Request bodies, headers and personal data are never sent (`sendDefaultPii: false`). The tags carry ids only.
- Alert rule: notify on-call for any new issue, and for more than 20 events in 10 minutes.

### Metrics (Prometheus)

- `GET /api/metrics` serves Prometheus text format. Set `METRICS_TOKEN` (24 characters or more); the scraper sends it as `Authorization: Bearer <token>`. Without the token set, the endpoint is a 404.

| Metric | Meaning |
| --- | --- |
| `school_erp_queue_jobs{queue,state}` | BullMQ jobs per queue that are `waiting`, `active`, `delayed` or `failed` |
| `school_erp_jobs_24h{type,status}` | Tracked jobs (`jobs` table) created in the last 24 hours |
| `school_erp_deliveries_24h{channel,status}` | Notification deliveries (`delivery_logs`) in the last 24 hours |
| `school_erp_process_uptime_seconds`, `_heap_bytes`, `_rss_bytes` | Process health |

Suggested alerts:

- `school_erp_queue_jobs{state="waiting"} > 500` for 10 minutes: workers are behind.
- Any increase in `school_erp_queue_jobs{state="failed"}`.
- `sum(school_erp_jobs_24h{status="failed"}) > 10`.
- `school_erp_deliveries_24h{status="failed"}` above 5% of all deliveries.
- Health check failing for 2 minutes.

### Logs

- Logs are JSON lines (pino). Each request has a `reqId` and ends with one `request completed` line.
- Ship stdout to the log store. Keep 30 days.

## 2. Backups (RPO 15 minutes)

### Postgres: point-in-time recovery

- Use continuous WAL archiving plus base backups. The commands below are plain Postgres; pgBackRest or WAL-G do the same with S3 storage, compression and retention built in. Prefer one of them in production.

  ```conf
  # postgresql.conf
  wal_level = replica
  archive_mode = on
  archive_command = 'pgbackrest --stanza=school-erp archive-push %p'   # or: wal-g wal-push %p
  archive_timeout = 60        # closes a WAL segment at least every minute
  ```

- Schedule:
  - A full base backup nightly (`pgbackrest backup --type=full`, or `pg_basebackup -Ft -z -Xs`).
  - A differential backup every 6 hours.
  - WAL is archived continuously.
- Retention: 14 daily, 8 weekly and 12 monthly backups, plus all the WAL needed for the dailies.
- `archive_timeout = 60` keeps data loss under one minute, well within the 15-minute RPO. Alert when the newest archived WAL is more than 5 minutes old (`pg_stat_archiver.last_archived_time`), or when `failed_count` rises.
- Backups go to a separate bucket in another region, with object lock or versioning, encrypted at rest. The database credentials can't delete them.
- A managed Postgres (RDS, Cloud SQL and similar) gives the same with automated backups and PITR enabled and retention set to 14 days or more. The restore drill below still applies.

### Files (S3 or MinIO)

- Turn on bucket versioning and replicate to a second region.
- Lifecycle: delete noncurrent versions after 30 days.
- Generated files (PDFs, exports) can be regenerated; uploads (photos, documents, imports) cannot.

### Redis

- Redis holds only queues and cache, so it needs no backup.
- Jobs lost with Redis can be re-run: each one has a `jobs` row. Turn on AOF (`appendonly yes`) so queued jobs survive a restart.

## 3. Restore

### Point-in-time restore (for example, undoing a bad deploy or a mass delete)

1. Pick the target time: just before the incident, in UTC, from the audit log or app logs.
2. Restore into a new instance. Never restore over the live primary.
   - pgBackRest:

     ```sh
     pgbackrest --stanza=school-erp --type=time "--target=2026-10-24 08:34:28+00" \
       --target-action=promote restore
     ```

   - By hand:
     1. Extract the newest base backup taken before the target.
     2. Set `restore_command` and `recovery_target_time`, and `recovery_target_action = 'promote'`.
     3. `touch recovery.signal`, then start the instance.
3. Check the restore:
   - The log says `recovery stopping before … time …` and `selected new timeline`.
   - Row counts for `organizations`, `students`, `payments` and `audit_logs` look right, and the newest `audit_logs.created_at` is just before the target.
   - Run `npm run db:status`: no pending migrations, unless the bad deploy brought new ones.
4. Cut over:
   1. Put the app in maintenance mode (scale to 0).
   2. Point `DB_HOST` at the restored instance, then start the app.
   3. Run `/api/health`.
   4. Resume the queues.
5. Afterwards:
   - Writes made after the target time are lost. Use the audit log to list them for affected schools: payments, mark changes, attendance.
   - Write up the incident.

### Restoring one school

- All schools share one schema, so one school can't be restored on its own in place.
- Restore to a scratch instance at the target time, then copy that school's rows across with `org_id = '<id>'` on each table, in foreign-key order. Do this only with a second engineer reviewing it.
- To give a school its data back, use the school data export (`POST /settings/export`) instead.

### Restore drill

Run the drill every quarter and before each major release (PRD 11.5).

1. Restore last night's backup plus WAL to a scratch instance, at a time 10 minutes before now.
2. Check it as in step 3 above.
3. Run `npm run db:migrate` (pending migrations, if any) and the e2e suite against it, with `DB_NAME` pointed at the copy. This also covers "migrations tested against a copy of production data".
4. Record the date, the backup used, the time to restore and any problems in the drill log below.

| Date | Environment | Backup / target | Result | Restore time | By |
| --- | --- | --- | --- | --- | --- |
| 2026-10-24 | Local Postgres 18 (`pg_basebackup -Ft -z -Xs`, WAL archive with `cp`, `archive_timeout=60`) | Base backup, plus 5,000 rows written after it, then a mass delete; target just before the delete | All 15,000 rows back; recovery stopped before the deleting transaction; new timeline 2 | 2 s (small data set) | Backend team |

The first production-like drill, on the pilot environment with the performance seed, is still to do before the pilot starts.

## 4. Pilot onboarding (platform admin)

Pilot schools are created by a platform admin, not through self-serve signup. There is no sample-data mode; schools start empty and are set up through onboarding.

1. Sign in on the admin host. Platform login is `POST /api/platform/auth/login`.
2. Create the owner's account:

   ```http
   POST /api/platform/users
   { "name": "Owner Name", "email": "owner@school.edu.bd", "password": "<random, never shared>", "status": "pending" }
   ```

   A `pending` account sets its own password when activated.
3. Create the school on a trial:

   ```http
   POST /api/organizations
   { "name": "Pilot School", "slug": "pilot-school", "ownerUserId": "<id>", "planCode": "standard", "trialDays": 90 }
   ```

   The owner gets an activation email, and the response carries the link (`activation`). To send the link again: `POST /api/organizations/:id/owner/activation-link`.
4. Plans and trials:
   - Change plan: `PATCH /api/organizations/:id/plan` with `{ "planCode": "standard", "addOnModules": [] }`.
   - Extend the trial by up to 90 days at a time: `POST /api/organizations/:id/trial/extend` with `{ "days": 30 }`.
   - Override limits: `PUT /api/organizations/:id/limits`.
5. The owner completes onboarding on `https://<slug>.<root domain>`: year, classes and sections, curriculum, grading and fee templates, staff invites, student import.
6. Track pilot schools in the platform list (`GET /api/organizations?status=trial`). Each is ready when `onboardingCompletedAt` is set.

## 5. Deploy checklist

- [ ] CI green: format, lint, typecheck, unit tests, release suites, e2e, build, and `npm audit --omit=dev --audit-level=high`.
- [ ] `npm run db:migrate:prod` runs before the new version takes traffic. Migrations are additive or backwards-compatible with the running version.
- [ ] Production env:
  - `NODE_ENV=production`, `DB_SYNC=false`.
  - `DB_APP_USERNAME` set: the restricted role, LOGIN NOSUPERUSER NOBYPASSRLS.
  - `CORS_ORIGIN`, `TRUST_PROXY`, `SENTRY_DSN`, `METRICS_TOKEN`, `FIELD_ENCRYPTION_KEY` and S3 credentials set.
- [ ] After deploy: `/api/health` shows all `up`, Sentry receives a test event, metrics are being scraped, and error volume is normal.
