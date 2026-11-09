import { useMemo } from 'react';
import { toast } from '../components/overlays/toast';
import type { DemoData } from '../types/domain';
import { useActingUser, useDemoStore, type ActionResult } from './demoStore';

export { useActingUser };

/** Name lookups used all over the UI. */
export function useLookups() {
  const data = useDemoStore((s) => s.data);
  return useMemo(() => makeLookups(data), [data]);
}

export function makeLookups(data: DemoData) {
  const map = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const users = map(data.users);
  const deps = map(data.departments);
  const teams = map(data.teams);
  const channels = map(data.channels);
  const customers = map(data.customers);
  return {
    user: (id?: string | null) => (id ? users.get(id) : undefined),
    userName: (id?: string | null) => (id ? (users.get(id)?.name ?? id) : '—'),
    depName: (id?: string | null) => (id ? (deps.get(id)?.name ?? id) : '—'),
    teamName: (id?: string | null) => (id ? (teams.get(id)?.name ?? id) : '—'),
    channel: (id?: string | null) => (id ? channels.get(id) : undefined),
    customer: (id?: string | null) => (id ? customers.get(id) : undefined),
  };
}

/** Shows a toast for an action result and returns whether it succeeded. */
export function report<T>(r: ActionResult<T>, success?: string): r is { ok: true; value: T } {
  if (r.ok) {
    if (success) toast.success(success);
    return true;
  }
  toast.error(r.error);
  return false;
}
