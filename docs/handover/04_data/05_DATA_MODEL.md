# 05 — Demo Data Model

## Main entities
- Department
- Team
- DemoUser
- Channel
- Customer
- Conversation
- Message
- Case
- Assignment
- Escalation
- InternalTask
- InternalComment
- TimelineEvent
- SlaRecord
- AuditEvent

## Key relationships
- Department has many Teams and Channels.
- Channel has many Customers and Conversations.
- Customer belongs to exactly one Channel in this demo.
- Conversation belongs to exactly one Channel and one Customer from that same Channel.
- Case belongs to one Conversation and preserves original Channel and Customer.
- Case can have many assignment-history records, but only one active PRIMARY_PIC.
- Case can have many Escalations and Internal Tasks.
- Internal Tasks and comments are internal-only.
- Timeline events are attached to Case.

## Demo identity rule
Use unique customer identity as `(channelId, lineUserId)`. Do not merge customers between channels even if display names look similar.

## Suggested mock channels
- Claims OA — Claims Department
- Service OA — Customer Service Department
- Sales OA — Sales Department

## Seed file
See `04_data/mock/seed.json`. Claude Code may extend it, but keep identifiers and references consistent.
