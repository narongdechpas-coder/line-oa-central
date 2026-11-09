# Jacky Central — OpenAPI 3.1 baseline

## Files
- `spec/openapi.yaml` — OpenAPI 3.1.0 API contract baseline.

## Included domains
Health, organization, identity, LINE OA channels, LINE webhooks, customers,
conversations/messages, cases, PIC recommendations and assignment history,
internal escalations, internal tasks/comments, RBAC/ABAC scopes, SLA, audit,
and operational summary reporting.

## Key contract rules
1. Customer identity is unique within a LINE OA (`channelId + lineUserId`).
2. Conversation/customer/channel consistency is validated by the backend and database.
3. A case's `originalChannelId` and `originalCustomerId` are immutable.
4. Escalation and internal tasks change internal ownership/work only.
5. Customer replies use the original conversation's LINE OA. The send-message
   request intentionally has no `channelId`.
6. LINE webhook signature validation uses the exact raw request body and the
   channel-specific secret. Persist before asynchronous processing.
7. Access control combines RBAC permissions with ABAC/resource scopes. Enforce
   authorization on every request at the backend; do not rely on UI filtering.
8. Channel credentials are represented by secret-manager references only.
9. Assignment recommendations are advisory; a Manager/Supervisor confirms or
   overrides the PIC assignment.

## Authentication
The API uses bearer JWT access tokens issued by the organization's OIDC/SSO
provider. Replace placeholder server URLs and configure issuer/audience
validation in the implementation.

## Production hardening before implementation
- Validate all status transitions and authorization policies against approved
  business process definitions.
- Define webhook event DTOs against the exact LINE Messaging API event schema.
- Add request/response examples, rate limits, idempotency requirements, and
  upload endpoints after the storage and attachment workflow is finalized.
- Confirm pagination conventions, filtering semantics, error codes, and
  timestamp/time-zone policy with frontend and backend teams.
- Run OpenAPI 3.1 validation and contract tests in CI.
- Review PDPA data minimization, retention, redaction, audit access, and
  attachment malware scanning requirements.

## Important
This is a contract baseline, not a claim that the API has been implemented or
integration-tested. It should be reviewed alongside the physical database
migration and the final authorization matrix.
