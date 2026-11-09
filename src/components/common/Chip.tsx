import type { ReactNode } from 'react';
import type { CaseStatus, EscalationStatus, Priority, SlaState, TaskStatus } from '../../types/domain';
import {
  CASE_STATUS_LABEL,
  CASE_STATUS_TONE,
  ESCALATION_STATUS_LABEL,
  ESCALATION_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  SLA_LABEL,
  SLA_TONE,
  TASK_STATUS_LABEL,
  TASK_TONE,
  type Tone,
} from '../../utils/labels';

export function Chip({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`chip chip-${tone}`} title={title}>
      <span className="chip-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export const CaseStatusChip = ({ status }: { status: CaseStatus }) => (
  <Chip tone={CASE_STATUS_TONE[status]} title={status}>{CASE_STATUS_LABEL[status]}</Chip>
);
export const PriorityChip = ({ priority }: { priority: Priority }) => (
  <Chip tone={PRIORITY_TONE[priority]} title={priority}>{PRIORITY_LABEL[priority]}</Chip>
);
export const EscalationChip = ({ status }: { status: EscalationStatus }) => (
  <Chip tone={ESCALATION_TONE[status]} title={status}>{ESCALATION_STATUS_LABEL[status]}</Chip>
);
export const TaskChip = ({ status }: { status: TaskStatus }) => (
  <Chip tone={TASK_TONE[status]} title={status}>{TASK_STATUS_LABEL[status]}</Chip>
);
export const SlaChip = ({ state }: { state: SlaState }) => (
  <Chip tone={SLA_TONE[state]} title="SLA จำลอง (SIMULATED)">{SLA_LABEL[state]}</Chip>
);

/** Visible marker for anything that would be an external integration in production. */
export const DemoTag = ({ children = 'DEMO' }: { children?: ReactNode }) => <span className="demo-tag">{children}</span>;
