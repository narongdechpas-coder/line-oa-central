import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Inbox, Lock, MessageSquarePlus, Send } from 'lucide-react';
import { useActingUser, useDemoStore } from '../../store/demoStore';
import { report, useLookups } from '../../store/hooks';
import { getConversation, lastMessage, listConversations, type ConversationFilters } from '../../services/mock/queries';
import { can, canSeeCase, canSeeConversation } from '../../utils/permissions';
import { CONVERSATION_STATUS_LABEL } from '../../utils/labels';
import { formatDateTime, formatTime } from '../../utils/time';
import { CONVERSATION_STATUSES } from '../../types/domain';
import { Avatar, Button, EmptyState, KeyValue, Restricted } from '../../components/common/ui';
import { CaseStatusChip, Chip, DemoTag } from '../../components/common/Chip';
import { ChannelBadge } from '../channels/ChannelBadge';
import { CreateCaseModal } from './CreateCaseModal';

export function InboxPage() {
  const { conversationId } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const data = useDemoStore((s) => s.data);
  const markRead = useDemoStore((s) => s.markRead);
  const me = useActingUser();
  const L = useLookups();

  const filters: ConversationFilters = {
    channelId: params.get('channel') ?? 'ALL',
    status: (params.get('status') as ConversationFilters['status']) ?? 'ALL',
    assignedUserId: params.get('pic') ?? 'ALL',
    departmentId: params.get('dep') ?? 'ALL',
    search: params.get('q') ?? '',
  };
  const setFilter = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (!v || v === 'ALL') p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: true });
  };

  const list = useMemo(() => listConversations(data, me, filters), [data, me, params]); // eslint-disable-line react-hooks/exhaustive-deps
  const scopedAll = useMemo(() => listConversations(data, me), [data, me]);
  const selected = conversationId ? getConversation(data, conversationId) : null;
  const allowed = selected ? canSeeConversation(data, me, selected.conversation) : true;

  useEffect(() => {
    if (conversationId && allowed) markRead(conversationId);
  }, [conversationId, allowed, markRead]);

  const pics = data.users.filter((u) => scopedAll.some((c) => c.assignedUserId === u.id));
  const qs = params.toString() ? `?${params.toString()}` : '';

  return (
    <div className="inbox">
      <section className="inbox-list" aria-label="รายการบทสนทนา">
        <div className="channel-tabs" role="tablist" aria-label="เลือก LINE OA">
          {[{ id: 'ALL', name: 'ทุก OA' }, ...data.channels].map((ch) => {
            const count = scopedAll.filter((c) => ch.id === 'ALL' || c.channelId === ch.id).length;
            const active = filters.channelId === ch.id;
            return (
              <button key={ch.id} type="button" role="tab" aria-selected={active} className={`channel-tab ${active ? 'active' : ''}`} onClick={() => setFilter('channel', ch.id)}>
                {ch.name} <span className="count">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="filters compact">
          <input aria-label="ค้นหาชื่อหรือข้อความ" placeholder="ค้นหาชื่อ, ข้อความ…" value={filters.search} onChange={(e) => setFilter('q', e.target.value)} />
          <select aria-label="สถานะบทสนทนา" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="ALL">ทุกสถานะ</option>
            {CONVERSATION_STATUSES.map((s) => (
              <option key={s} value={s}>{CONVERSATION_STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select aria-label="PIC" value={filters.assignedUserId} onChange={(e) => setFilter('pic', e.target.value)}>
            <option value="ALL">ทุก PIC</option>
            <option value="UNASSIGNED">ยังไม่มี PIC</option>
            {pics.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select aria-label="แผนกเจ้าของ OA" value={filters.departmentId} onChange={(e) => setFilter('dep', e.target.value)}>
            <option value="ALL">ทุกแผนก</option>
            {data.departments.filter((d) => data.channels.some((c) => c.departmentId === d.id)).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <ul className="conv-list">
          {list.length === 0 && (
            <li>
              <EmptyState icon={<Inbox size={28} />} title="ไม่มีบทสนทนาตามตัวกรอง" hint={scopedAll.length ? 'ลองล้างตัวกรอง' : 'บทบาทนี้ยังไม่มีบทสนทนาที่ได้รับมอบหมาย'} />
            </li>
          )}
          {list.map((c) => {
            const cus = L.customer(c.customerId);
            const last = lastMessage(data, c.id);
            const caseCount = data.cases.filter((k) => k.conversationId === c.id).length;
            return (
              <li key={c.id}>
                <Link to={`/inbox/${c.id}${qs}`} className={`conv-item ${c.id === conversationId ? 'active' : ''}`} aria-current={c.id === conversationId ? 'true' : undefined}>
                  <div className="conv-top">
                    <ChannelBadge channelId={c.channelId} small />
                    <span className="muted small">{formatTime(c.lastMessageAt)}</span>
                  </div>
                  <div className="conv-name">
                    <strong>{cus?.displayName}</strong>
                    {c.unread > 0 && <span className="unread" aria-label={`${c.unread} ข้อความใหม่`}>{c.unread}</span>}
                  </div>
                  <p className="conv-snippet">{last?.direction === 'OUTBOUND' ? 'คุณ: ' : ''}{last?.text}</p>
                  <div className="conv-meta">
                    <span>{CONVERSATION_STATUS_LABEL[c.status]}</span>
                    <span>· PIC: {L.userName(c.assignedUserId)}</span>
                    {caseCount > 0 && <span>· {caseCount} Case</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {!selected ? (
        <section className="inbox-thread empty-col">
          <EmptyState icon={<MessageSquarePlus size={32} />} title={conversationId ? 'ไม่พบบทสนทนานี้' : 'เลือกบทสนทนาทางซ้าย'} hint="ข้อความทั้งหมดเป็นข้อมูลจำลอง ไม่ได้มาจาก LINE จริง" />
        </section>
      ) : !allowed ? (
        <section className="inbox-thread empty-col">
          <Restricted message="บทสนทนานี้อยู่นอกขอบเขตของบทบาทเดโม่ปัจจุบัน" />
        </section>
      ) : (
        <>
          <Thread conversationId={selected.conversation.id} />
          <CustomerPanel conversationId={selected.conversation.id} onCreated={(id) => nav(`/cases/${id}`)} />
        </>
      )}
    </div>
  );
}

export function Thread({ conversationId }: { conversationId: string }) {
  const data = useDemoStore((s) => s.data);
  const sendReply = useDemoStore((s) => s.sendReply);
  const me = useActingUser();
  const L = useLookups();
  const conv = getConversation(data, conversationId)!;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [conv.messages.length, conversationId]);

  const canReply = can(me, 'conversation.reply') && (me.role !== 'PIC_AGENT' || conv.conversation.assignedUserId === me.id);
  const send = () => {
    const r = sendReply(conversationId, text);
    if (r.ok) {
      setText('');
      setError(null);
      report(r, 'บันทึกข้อความจำลองแล้ว — ไม่ได้ส่งไป LINE');
    } else setError(r.error);
  };

  return (
    <section className="inbox-thread" aria-label="บทสนทนา">
      <header className="thread-head">
        <Avatar name={conv.customer?.displayName ?? '?'} size={36} />
        <div>
          <strong>{conv.customer?.displayName}</strong>
          <div className="muted small">
            <ChannelBadge channelId={conv.conversation.channelId} small /> · {CONVERSATION_STATUS_LABEL[conv.conversation.status]}
          </div>
        </div>
        <DemoTag>SIMULATED DATA</DemoTag>
      </header>
      <div className="messages">
        {conv.messages.map((m) => (
          <div key={m.id} className={`msg ${m.direction === 'OUTBOUND' ? 'out' : 'in'}`}>
            <div className="bubble">{m.text}</div>
            <div className="msg-meta">
              {formatDateTime(m.createdAt)}
              {m.direction === 'OUTBOUND' && (
                <>
                  {m.sentByUserId && <> · {L.userName(m.sentByUserId)}</>}
                  <span className="not-sent">SIMULATED — NOT SENT TO LINE</span>
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <div className="composer">
        <div className="composer-channel">
          <Lock size={12} aria-hidden="true" /> ตอบผ่าน <strong>{L.channel(conv.conversation.channelId)?.name}</strong> (ช่องทางเดิมของบทสนทนา — เปลี่ยนไม่ได้)
        </div>
        {canReply ? (
          <form
            className="composer-row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label htmlFor="reply" className="sr-only">ข้อความตอบลูกค้า</label>
            <textarea
              id="reply"
              rows={2}
              placeholder="พิมพ์ข้อความ… (Enter เพื่อบันทึก, Shift+Enter ขึ้นบรรทัดใหม่)"
              value={text}
              aria-invalid={!!error}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button type="submit" variant="primary" icon={<Send size={16} />}>บันทึก (จำลอง)</Button>
          </form>
        ) : (
          <p className="muted small">บทบาทนี้ตอบลูกค้าไม่ได้{me.role === 'PIC_AGENT' ? ' (PIC ตอบได้เฉพาะบทสนทนาที่ได้รับมอบหมาย)' : ''}</p>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
        <p className="composer-note">ข้อความจะถูกเก็บในเบราว์เซอร์นี้เท่านั้น — SIMULATED — NOT SENT TO LINE</p>
      </div>
    </section>
  );
}

function CustomerPanel({ conversationId, onCreated }: { conversationId: string; onCreated: (caseId: string) => void }) {
  const data = useDemoStore((s) => s.data);
  const me = useActingUser();
  const [creating, setCreating] = useState(false);
  const conv = getConversation(data, conversationId)!;
  const cus = conv.customer;
  return (
    <aside className="inbox-side" aria-label="ข้อมูลลูกค้า">
      <h2 className="side-title">ข้อมูลลูกค้า</h2>
      <div className="customer-head">
        <Avatar name={cus?.displayName ?? '?'} size={44} />
        <strong>{cus?.displayName}</strong>
      </div>
      <KeyValue
        items={[
          ['LINE OA', <ChannelBadge key="c" channelId={conv.conversation.channelId} />],
          ['LINE User ID', <span key="u" className="mono">{cus?.lineUserId} <DemoTag>MOCK</DemoTag></span>],
          ['โทรศัพท์', cus?.phone ?? '—'],
          ['แท็ก', <span key="t" className="tags">{cus?.tags.map((t) => <Chip key={t} tone="gray">{t}</Chip>)}</span>],
        ]}
      />
      <p className="muted small">ตัวตนลูกค้าผูกกับ OA นี้เท่านั้น ระบบไม่รวมลูกค้าข้าม OA แม้ชื่อเหมือนกัน</p>

      <h3 className="side-sub">Case ที่เกี่ยวข้อง</h3>
      {conv.cases.length === 0 && <p className="muted small">ยังไม่มี Case</p>}
      <ul className="related">
        {conv.cases.map((c) => (
          <li key={c.id}>
            {canSeeCase(data, me, c) ? (
              <Link to={`/cases/${c.id}`} className="related-item">
                <span className="mono">{c.caseNumber}</span>
                <CaseStatusChip status={c.status} />
                <span className="related-title">{c.title}</span>
              </Link>
            ) : (
              <span className="related-item muted"><Lock size={12} /> {c.caseNumber} (นอกขอบเขตสิทธิ์)</span>
            )}
          </li>
        ))}
      </ul>
      {can(me, 'case.create') ? (
        <Button variant="primary" icon={<MessageSquarePlus size={16} />} onClick={() => setCreating(true)}>Create Case</Button>
      ) : (
        <p className="muted small">บทบาทนี้สร้าง Case ไม่ได้</p>
      )}
      {creating && (
        <CreateCaseModal
          conversationId={conversationId}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onCreated(id);
          }}
        />
      )}
    </aside>
  );
}
