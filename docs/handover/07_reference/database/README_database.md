# Jacky Central – Physical Database Package v1.1

## Contents
- `migrations/001_initial_schema.sql`: PostgreSQL initial schema migration.
- `erd/jacky_central_physical_erd.mmd`: Mermaid ER diagram source.

## Target
PostgreSQL 15+.

## Apply
Run the SQL migration with a PostgreSQL migration runner or `psql` against an empty development database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_initial_schema.sql
```

Do not apply this file to a populated production database without a reviewed migration plan and backup.

## Key design decisions
1. Customer identity is unique per LINE OA: `UNIQUE(channel_id, line_user_id)`.
2. Conversations enforce that their customer belongs to the same channel through a composite foreign key.
3. Cases preserve `original_channel_id` and `original_customer_id`.
4. Escalations and internal tasks are backend records; they do not create or switch LINE OA channels.
5. LINE credentials are represented by Secret Manager references, not plaintext tokens.
6. All timestamps use `TIMESTAMPTZ`; application services should write UTC.
7. `case_assignments` keeps assignment history and enforces one active primary PIC per case.
8. `outbox_events` supports reliable event publication after database commits.

## Important implementation notes
- The application must enforce immutability of `cases.original_channel_id` and `cases.original_customer_id`.
- The API must derive the outbound LINE channel from the persisted conversation, never from an untrusted client-supplied channel ID.
- Webhook signature verification must use the exact raw request body and the channel-specific secret before accepting the event.
- Webhook processing must be idempotent. `webhook_events` has a channel/event uniqueness constraint; where LINE does not provide a stable event ID for a given event shape, implement a deterministic deduplication key based on the event payload and documented LINE semantics.
- The permission tables provide the RBAC foundation. Resource-scope evaluation (RBAC + ABAC) remains an application-layer policy responsibility.
- The migration creates schemas and tables but does not create production users, passwords, secrets, or role assignments.
- Review data retention, encryption, backup, access logging, and PDPA requirements with the organization's security and compliance owners before production.

## Known scope boundary
This is the initial physical baseline for core operational entities. Additional domain-specific fields, message content retention rules, business-hour calendars, skill catalogs, and advanced assignment configuration can be added in subsequent migrations after requirements are confirmed.
