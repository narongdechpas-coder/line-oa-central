-- Jacky Central Communication & Case Management Platform
-- Physical Database Migration: 001_initial_schema.sql
-- Target: PostgreSQL 15+
-- Version: 1.1
-- Notes:
--   * UUID primary keys use gen_random_uuid() (pgcrypto).
--   * Timestamps are stored in UTC using TIMESTAMPTZ.
--   * LINE customer identity is unique per channel, not globally.
--   * Escalation is backend-only; original_channel_id is immutable by application policy.
--   * Apply using a migration runner; do not execute repeatedly without migration tracking.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS organization;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS channel;
CREATE SCHEMA IF NOT EXISTS customer;
CREATE SCHEMA IF NOT EXISTS communication;
CREATE SCHEMA IF NOT EXISTS case_management;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS governance;
CREATE SCHEMA IF NOT EXISTS operations;

-- ---------------------------------------------------------------------------
-- ORGANIZATION
-- ---------------------------------------------------------------------------

CREATE TABLE organization.departments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(30) NOT NULL UNIQUE,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization.teams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID NOT NULL REFERENCES organization.departments(id),
    code            VARCHAR(30) NOT NULL,
    name            VARCHAR(150) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_teams_department_code UNIQUE (department_id, code),
    CONSTRAINT uq_teams_id_department UNIQUE (id, department_id)
);

CREATE TABLE organization.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code   VARCHAR(50) UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    display_name    VARCHAR(255) NOT NULL,
    identity_subject VARCHAR(255) UNIQUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization.team_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES organization.teams(id),
    user_id         UUID NOT NULL REFERENCES organization.users(id),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_team_members_dates CHECK (left_at IS NULL OR left_at >= joined_at),
    CONSTRAINT uq_team_members_active_pair UNIQUE (team_id, user_id, joined_at)
);

CREATE INDEX ix_teams_department ON organization.teams(department_id);
CREATE INDEX ix_team_members_user ON organization.team_members(user_id);
CREATE INDEX ix_team_members_active_team ON organization.team_members(team_id)
    WHERE left_at IS NULL;

-- ---------------------------------------------------------------------------
-- IDENTITY / RBAC / SCOPE
-- ---------------------------------------------------------------------------

CREATE TABLE identity.roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    is_system_role  BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE identity.permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    resource        VARCHAR(50) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_permissions_resource_action UNIQUE (resource, action)
);

CREATE TABLE identity.role_permissions (
    role_id         UUID NOT NULL REFERENCES identity.roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES identity.permissions(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE identity.user_roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES organization.users(id),
    role_id         UUID NOT NULL REFERENCES identity.roles(id),
    granted_by      UUID REFERENCES organization.users(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    CONSTRAINT ck_user_roles_expiry CHECK (expires_at IS NULL OR expires_at > granted_at)
);

CREATE UNIQUE INDEX uq_user_roles_active
    ON identity.user_roles(user_id, role_id)
    WHERE revoked_at IS NULL;

-- A scope row grants a role's permissions only within the stated resource scope.
CREATE TABLE identity.user_scopes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_role_id    UUID NOT NULL REFERENCES identity.user_roles(id) ON DELETE CASCADE,
    scope_type      VARCHAR(20) NOT NULL
                    CHECK (scope_type IN ('GLOBAL', 'DEPARTMENT', 'TEAM', 'CHANNEL', 'ASSIGNED')),
    department_id   UUID REFERENCES organization.departments(id),
    team_id         UUID REFERENCES organization.teams(id),
    channel_id      UUID, -- FK added after channel.line_channels is created.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_user_scopes_shape CHECK (
        (scope_type = 'GLOBAL' AND department_id IS NULL AND team_id IS NULL AND channel_id IS NULL)
        OR (scope_type = 'DEPARTMENT' AND department_id IS NOT NULL AND team_id IS NULL AND channel_id IS NULL)
        OR (scope_type = 'TEAM' AND team_id IS NOT NULL AND channel_id IS NULL)
        OR (scope_type = 'CHANNEL' AND channel_id IS NOT NULL)
        OR (scope_type = 'ASSIGNED' AND department_id IS NULL AND team_id IS NULL AND channel_id IS NULL)
    )
);

CREATE INDEX ix_user_roles_user ON identity.user_roles(user_id);
CREATE INDEX ix_user_scopes_role ON identity.user_scopes(user_role_id);
CREATE INDEX ix_permissions_resource ON identity.permissions(resource);

-- ---------------------------------------------------------------------------
-- CHANNEL / LINE OA
-- ---------------------------------------------------------------------------

CREATE TABLE channel.line_channels (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id       UUID NOT NULL REFERENCES organization.departments(id),
    default_team_id     UUID,
    line_channel_id     VARCHAR(100) NOT NULL UNIQUE,
    channel_name        VARCHAR(150) NOT NULL,
    provider            VARCHAR(30) NOT NULL DEFAULT 'LINE'
                        CHECK (provider = 'LINE'),
    webhook_path_key    VARCHAR(100) NOT NULL UNIQUE,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'ACTIVE', 'DISABLED', 'ERROR')),
    webhook_verified_at TIMESTAMPTZ,
    last_event_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_line_channels_default_team_department
        FOREIGN KEY (default_team_id, department_id)
        REFERENCES organization.teams(id, department_id)
);

ALTER TABLE identity.user_scopes
    ADD CONSTRAINT fk_user_scopes_channel
    FOREIGN KEY (channel_id) REFERENCES channel.line_channels(id);

CREATE TABLE channel.channel_credentials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id          UUID NOT NULL REFERENCES channel.line_channels(id) ON DELETE CASCADE,
    credential_type     VARCHAR(30) NOT NULL
                        CHECK (credential_type IN ('CHANNEL_SECRET', 'CHANNEL_ACCESS_TOKEN')),
    secret_reference    VARCHAR(500) NOT NULL,
    version_label       VARCHAR(100),
    rotated_at          TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_channel_credential_version UNIQUE (channel_id, credential_type, version_label)
);

CREATE INDEX ix_line_channels_department ON channel.line_channels(department_id);
CREATE INDEX ix_line_channels_status ON channel.line_channels(status);
CREATE INDEX ix_channel_credentials_channel ON channel.channel_credentials(channel_id);

-- ---------------------------------------------------------------------------
-- CUSTOMER IDENTITY
-- ---------------------------------------------------------------------------

CREATE TABLE customer.customers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id          UUID NOT NULL REFERENCES channel.line_channels(id),
    line_user_id        VARCHAR(100) NOT NULL,
    display_name        VARCHAR(255),
    picture_url         TEXT,
    contact_status      VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN'
                        CHECK (contact_status IN ('UNKNOWN', 'FOLLOWING', 'UNFOLLOWED', 'BLOCKED')),
    first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_customer_channel_line_user UNIQUE (channel_id, line_user_id),
    CONSTRAINT uq_customer_id_channel UNIQUE (id, channel_id)
);

CREATE INDEX ix_customers_channel ON customer.customers(channel_id);
CREATE INDEX ix_customers_line_user ON customer.customers(line_user_id);

-- ---------------------------------------------------------------------------
-- COMMUNICATION
-- ---------------------------------------------------------------------------

CREATE TABLE communication.conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id          UUID NOT NULL REFERENCES channel.line_channels(id),
    customer_id         UUID NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN', 'PENDING', 'CLOSED', 'ARCHIVED')),
    assigned_team_id    UUID REFERENCES organization.teams(id),
    assigned_user_id    UUID REFERENCES organization.users(id),
    last_message_at     TIMESTAMPTZ,
    opened_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_conversation_customer_channel
        FOREIGN KEY (customer_id, channel_id)
        REFERENCES customer.customers(id, channel_id),
    CONSTRAINT ck_conversation_closed CHECK (closed_at IS NULL OR status IN ('CLOSED', 'ARCHIVED'))
);

CREATE TABLE communication.messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES communication.conversations(id),
    direction           VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    message_type        VARCHAR(30) NOT NULL
                        CHECK (message_type IN ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'LOCATION', 'TEMPLATE', 'OTHER')),
    line_message_id     VARCHAR(100),
    line_webhook_event_id VARCHAR(100),
    content             JSONB,
    delivery_status     VARCHAR(30) NOT NULL DEFAULT 'RECEIVED'
                        CHECK (delivery_status IN ('RECEIVED', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'UNKNOWN')),
    sender_line_user_id VARCHAR(100),
    sent_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_messages_line_message UNIQUE (line_message_id)
);

CREATE INDEX ix_conversations_channel_status ON communication.conversations(channel_id, status);
CREATE INDEX ix_conversations_customer ON communication.conversations(customer_id);
CREATE INDEX ix_conversations_last_message ON communication.conversations(last_message_at DESC);
CREATE INDEX ix_messages_conversation_created ON communication.messages(conversation_id, created_at DESC);
CREATE INDEX ix_messages_delivery_status ON communication.messages(delivery_status);

CREATE TABLE communication.attachments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id          UUID NOT NULL REFERENCES communication.messages(id) ON DELETE CASCADE,
    storage_key         VARCHAR(500) NOT NULL,
    file_name           VARCHAR(255),
    mime_type           VARCHAR(150),
    file_size_bytes     BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    checksum_sha256     VARCHAR(64),
    malware_scan_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (malware_scan_status IN ('PENDING', 'CLEAN', 'INFECTED', 'ERROR')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE communication.webhook_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id          UUID NOT NULL REFERENCES channel.line_channels(id),
    webhook_event_id    VARCHAR(150),
    event_type          VARCHAR(50) NOT NULL,
    payload             JSONB NOT NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at        TIMESTAMPTZ,
    processing_status   VARCHAR(20) NOT NULL DEFAULT 'RECEIVED'
                        CHECK (processing_status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER')),
    retry_count         INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    last_error          TEXT,
    CONSTRAINT uq_webhook_channel_event UNIQUE (channel_id, webhook_event_id)
);

CREATE INDEX ix_webhook_events_status_received
    ON communication.webhook_events(processing_status, received_at);

-- ---------------------------------------------------------------------------
-- CASE MANAGEMENT
-- ---------------------------------------------------------------------------

CREATE TABLE case_management.cases (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number             VARCHAR(40) NOT NULL UNIQUE,
    conversation_id         UUID NOT NULL REFERENCES communication.conversations(id),
    original_channel_id     UUID NOT NULL REFERENCES channel.line_channels(id),
    original_customer_id    UUID NOT NULL,
    original_owner_id       UUID REFERENCES organization.users(id),
    current_department_id   UUID NOT NULL REFERENCES organization.departments(id),
    current_team_id         UUID,
    current_owner_id        UUID REFERENCES organization.users(id),
    status                  VARCHAR(30) NOT NULL DEFAULT 'NEW'
                            CHECK (status IN ('NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED')),
    priority                VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
                            CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    case_type               VARCHAR(50),
    subject                 VARCHAR(255),
    description             TEXT,
    escalation_level        INTEGER NOT NULL DEFAULT 0 CHECK (escalation_level >= 0),
    version                 INTEGER NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at             TIMESTAMPTZ,
    closed_at               TIMESTAMPTZ,
    CONSTRAINT fk_case_original_customer_channel
        FOREIGN KEY (original_customer_id, original_channel_id)
        REFERENCES customer.customers(id, channel_id),
    CONSTRAINT fk_case_current_team_department
        FOREIGN KEY (current_team_id, current_department_id)
        REFERENCES organization.teams(id, department_id),
    CONSTRAINT uq_case_id_original_channel UNIQUE (id, original_channel_id)
);

CREATE INDEX ix_cases_department_status ON case_management.cases(current_department_id, status);
CREATE INDEX ix_cases_team_status ON case_management.cases(current_team_id, status);
CREATE INDEX ix_cases_owner_status ON case_management.cases(current_owner_id, status);
CREATE INDEX ix_cases_channel_created ON case_management.cases(original_channel_id, created_at DESC);
CREATE INDEX ix_cases_priority_created ON case_management.cases(priority, created_at DESC);

CREATE TABLE case_management.case_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES case_management.cases(id),
    user_id             UUID NOT NULL REFERENCES organization.users(id),
    assignment_type     VARCHAR(30) NOT NULL
                        CHECK (assignment_type IN ('PRIMARY_PIC', 'BACKUP_PIC', 'REVIEWER', 'APPROVER', 'OBSERVER')),
    assignment_mode     VARCHAR(30) NOT NULL
                        CHECK (assignment_mode IN ('MANUAL', 'SYSTEM_RECOMMENDED', 'MANAGER_OVERRIDE', 'RULE_BASED')),
    assigned_by         UUID REFERENCES organization.users(id),
    reason              TEXT,
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at            TIMESTAMPTZ,
    CONSTRAINT ck_case_assignment_dates CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);

CREATE UNIQUE INDEX uq_case_active_primary_pic
    ON case_management.case_assignments(case_id)
    WHERE assignment_type = 'PRIMARY_PIC' AND ended_at IS NULL;

CREATE INDEX ix_case_assignments_user_active
    ON case_management.case_assignments(user_id, assigned_at DESC)
    WHERE ended_at IS NULL;

CREATE TABLE case_management.case_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES case_management.cases(id),
    event_type          VARCHAR(50) NOT NULL,
    actor_id            UUID REFERENCES organization.users(id),
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_case_events_case_created
    ON case_management.case_events(case_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- WORKFLOW / ESCALATION / INTERNAL TASKS
-- ---------------------------------------------------------------------------

CREATE TABLE workflow.escalation_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code           VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(150) NOT NULL,
    trigger_type        VARCHAR(30) NOT NULL
                        CHECK (trigger_type IN ('MANUAL', 'TIME_BASED', 'RULE_BASED')),
    source_department_id UUID REFERENCES organization.departments(id),
    target_department_id UUID REFERENCES organization.departments(id),
    target_team_id      UUID REFERENCES organization.teams(id),
    target_role_code    VARCHAR(50),
    threshold_minutes   INTEGER CHECK (threshold_minutes IS NULL OR threshold_minutes >= 0),
    conditions          JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workflow.escalations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES case_management.cases(id),
    rule_id             UUID REFERENCES workflow.escalation_rules(id),
    from_user_id        UUID REFERENCES organization.users(id),
    to_user_id          UUID REFERENCES organization.users(id),
    from_department_id  UUID REFERENCES organization.departments(id),
    to_department_id    UUID NOT NULL REFERENCES organization.departments(id),
    target_team_id      UUID REFERENCES organization.teams(id),
    reason              TEXT NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'REQUESTED'
                        CHECK (status IN ('REQUESTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')),
    keep_original_owner BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at         TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    CONSTRAINT ck_escalation_resolved CHECK (resolved_at IS NULL OR status IN ('RESOLVED', 'CANCELLED'))
);

CREATE INDEX ix_escalations_case_created ON workflow.escalations(case_id, created_at DESC);
CREATE INDEX ix_escalations_target_status ON workflow.escalations(to_department_id, status);

CREATE TABLE workflow.internal_tasks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id                 UUID NOT NULL REFERENCES case_management.cases(id),
    escalation_id           UUID REFERENCES workflow.escalations(id),
    source_department_id    UUID NOT NULL REFERENCES organization.departments(id),
    target_department_id    UUID NOT NULL REFERENCES organization.departments(id),
    target_team_id          UUID REFERENCES organization.teams(id),
    assigned_user_id        UUID REFERENCES organization.users(id),
    created_by              UUID REFERENCES organization.users(id),
    task_type               VARCHAR(50) NOT NULL DEFAULT 'REVIEW',
    title                   VARCHAR(255) NOT NULL,
    description             TEXT,
    status                  VARCHAR(30) NOT NULL DEFAULT 'OPEN'
                            CHECK (status IN ('OPEN', 'ACCEPTED', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED')),
    due_at                  TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_internal_tasks_target_status
    ON workflow.internal_tasks(target_department_id, status, due_at);
CREATE INDEX ix_internal_tasks_assignee_status
    ON workflow.internal_tasks(assigned_user_id, status);

CREATE TABLE workflow.internal_task_comments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id             UUID NOT NULL REFERENCES workflow.internal_tasks(id) ON DELETE CASCADE,
    author_id           UUID NOT NULL REFERENCES organization.users(id),
    comment_text        TEXT NOT NULL,
    visibility          VARCHAR(20) NOT NULL DEFAULT 'INTERNAL'
                        CHECK (visibility = 'INTERNAL'),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- GOVERNANCE / AUDIT
-- ---------------------------------------------------------------------------

CREATE TABLE governance.audit_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id            UUID REFERENCES organization.users(id),
    action              VARCHAR(100) NOT NULL,
    resource_type       VARCHAR(50) NOT NULL,
    resource_id         UUID,
    outcome             VARCHAR(20) NOT NULL DEFAULT 'SUCCESS'
                        CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILED')),
    request_id          VARCHAR(100),
    ip_address          INET,
    user_agent          TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_audit_actor_created ON governance.audit_logs(actor_id, created_at DESC);
CREATE INDEX ix_audit_resource_created ON governance.audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX ix_audit_action_created ON governance.audit_logs(action, created_at DESC);

CREATE TABLE governance.access_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id            UUID REFERENCES organization.users(id),
    resource_type       VARCHAR(50) NOT NULL,
    resource_id         UUID,
    access_action       VARCHAR(30) NOT NULL,
    decision            VARCHAR(20) NOT NULL CHECK (decision IN ('ALLOW', 'DENY')),
    policy_code         VARCHAR(100),
    request_id          VARCHAR(100),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_access_logs_actor_created ON governance.access_logs(actor_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- OPERATIONS / SLA / NOTIFICATION / OUTBOX
-- ---------------------------------------------------------------------------

CREATE TABLE operations.sla_policies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_code         VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(150) NOT NULL,
    department_id       UUID REFERENCES organization.departments(id),
    case_type           VARCHAR(50),
    priority            VARCHAR(20),
    first_response_minutes INTEGER CHECK (first_response_minutes IS NULL OR first_response_minutes >= 0),
    resolution_minutes  INTEGER CHECK (resolution_minutes IS NULL OR resolution_minutes >= 0),
    business_hours_only BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE operations.case_sla_tracking (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES case_management.cases(id),
    sla_policy_id       UUID NOT NULL REFERENCES operations.sla_policies(id),
    first_response_due_at TIMESTAMPTZ,
    resolution_due_at   TIMESTAMPTZ,
    first_response_at   TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    first_response_breached BOOLEAN NOT NULL DEFAULT FALSE,
    resolution_breached BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_case_sla_policy UNIQUE (case_id, sla_policy_id)
);

CREATE TABLE operations.notification_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id   UUID REFERENCES organization.users(id),
    notification_type   VARCHAR(50) NOT NULL,
    reference_type      VARCHAR(50),
    reference_id        UUID,
    delivery_channel    VARCHAR(30) NOT NULL
                        CHECK (delivery_channel IN ('IN_APP', 'EMAIL', 'PUSH', 'OTHER')),
    status              VARCHAR(20) NOT NULL DEFAULT 'QUEUED'
                        CHECK (status IN ('QUEUED', 'SENT', 'FAILED', 'READ')),
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at             TIMESTAMPTZ,
    read_at             TIMESTAMPTZ
);

CREATE TABLE operations.outbox_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type      VARCHAR(50) NOT NULL,
    aggregate_id        UUID NOT NULL,
    event_type          VARCHAR(100) NOT NULL,
    payload             JSONB NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
    attempts            INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at        TIMESTAMPTZ
);

CREATE INDEX ix_outbox_pending ON operations.outbox_events(created_at)
    WHERE status = 'PENDING';
CREATE INDEX ix_sla_tracking_due ON operations.case_sla_tracking(resolution_due_at)
    WHERE resolved_at IS NULL;
CREATE INDEX ix_notifications_recipient_created
    ON operations.notification_logs(recipient_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION operations.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl TEXT;
    sch TEXT;
BEGIN
    FOREACH sch IN ARRAY ARRAY[
        'organization', 'channel', 'customer', 'communication',
        'case_management', 'workflow'
    ]
    LOOP
        FOREACH tbl IN ARRAY CASE sch
            WHEN 'organization' THEN ARRAY['departments','teams','users']
            WHEN 'channel' THEN ARRAY['line_channels']
            WHEN 'customer' THEN ARRAY['customers']
            WHEN 'communication' THEN ARRAY['conversations']
            WHEN 'case_management' THEN ARRAY['cases']
            WHEN 'workflow' THEN ARRAY['internal_tasks','escalation_rules']
            ELSE ARRAY[]::TEXT[]
        END
        LOOP
            EXECUTE format(
                'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION operations.set_updated_at()',
                tbl, sch, tbl
            );
        END LOOP;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- SEED: CORE PERMISSION CATALOG
-- ---------------------------------------------------------------------------

INSERT INTO identity.permissions (code, description, resource, action) VALUES
('channel.view', 'View LINE OA channels', 'channel', 'view'),
('channel.manage', 'Manage LINE OA channels', 'channel', 'manage'),
('conversation.view', 'View authorized conversations', 'conversation', 'view'),
('conversation.reply', 'Reply through original LINE OA', 'conversation', 'reply'),
('case.create', 'Create case', 'case', 'create'),
('case.view_assigned', 'View assigned cases', 'case', 'view_assigned'),
('case.view_team', 'View team cases', 'case', 'view_team'),
('case.view_department', 'View department cases', 'case', 'view_department'),
('case.assign', 'Assign primary PIC', 'case', 'assign'),
('case.reassign', 'Reassign PIC', 'case', 'reassign'),
('case.escalate', 'Create internal escalation', 'case', 'escalate'),
('case.close', 'Close case', 'case', 'close'),
('case.reopen', 'Reopen case', 'case', 'reopen'),
('internal_task.create', 'Create internal task', 'internal_task', 'create'),
('internal_task.assign', 'Assign internal task', 'internal_task', 'assign'),
('internal_task.complete', 'Complete internal task', 'internal_task', 'complete'),
('user.manage', 'Manage users', 'user', 'manage'),
('role.manage', 'Manage roles and permissions', 'role', 'manage'),
('audit.view', 'View audit logs', 'audit', 'view'),
('report.view', 'View reports', 'report', 'view')
ON CONFLICT (code) DO NOTHING;

COMMIT;
