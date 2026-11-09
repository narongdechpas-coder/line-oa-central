import { useDemoStore } from '../../store/demoStore';

/** LINE OA identity badge. Colour is paired with the channel name, never used alone. */
export function ChannelBadge({ channelId, small }: { channelId: string; small?: boolean }) {
  const ch = useDemoStore((s) => s.data.channels.find((c) => c.id === channelId));
  if (!ch) return null;
  return (
    <span className={`ch-badge ${small ? 'small' : ''}`}>
      <span className="ch-dot" style={{ background: ch.color }} aria-hidden="true" />
      {ch.name}
    </span>
  );
}
