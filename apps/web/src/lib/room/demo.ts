import {
  type Card,
  type LifetimeHours,
  type LoopbackClient,
  LoopbackEngine,
  presetScale,
  type RoomConfigInput,
  type RoomLink,
  type RoomView,
} from '@backlogfit/core';

const engines = new Map<string, LoopbackEngine>();
const alarmTimers = new Map<string, ReturnType<typeof setInterval>>();
const pendingTasks = new Map<string, string[]>();

export const SAMPLE_TASKS = [
  'DEMO-101 Export results as CSV',
  'DEMO-102 Single sign-on for admins',
  'DEMO-103 Audit log retention',
] as const;

/** Sample tasks for a fresh demo room, handed out once (the host's own connection adds them). */
export function takeDemoTasks(roomId: string): string[] | null {
  const t = pendingTasks.get(roomId) ?? null;
  pendingTasks.delete(roomId);
  return t;
}

export function demoEngine(roomId: string): LoopbackEngine | null {
  return engines.get(roomId) ?? null;
}

export const BOT_NAMES = ['Ada', 'Grace', 'Linus'] as const;

export interface DemoOptions {
  config?: RoomConfigInput;
  lifetimeHours?: LifetimeHours;
  passcode?: string;
  bots?: number;
  sampleTasks?: boolean;
  now?: () => number;
}

export async function createDemoRoom(opts: DemoOptions = {}): Promise<RoomLink> {
  const now = opts.now ?? (() => Date.now());
  const { engine, roomId, joinSecret, adminSecret } = await LoopbackEngine.create(
    {
      config: opts.config ?? { scale: presetScale('fibonacci') },
      lifetimeHours: opts.lifetimeHours ?? 2,
      ...(opts.passcode ? { passcode: opts.passcode } : {}),
    },
    { now },
  );
  engines.set(roomId, engine);
  if (typeof setInterval !== 'undefined') {
    alarmTimers.set(
      roomId,
      setInterval(() => {
        void engine.runAlarms();
        if (engine.closed) stopDemo(roomId);
      }, 1000),
    );
  }
  const bots = opts.bots ?? BOT_NAMES.length;
  if (opts.sampleTasks) pendingTasks.set(roomId, [...SAMPLE_TASKS]);
  for (let i = 0; i < Math.min(bots, BOT_NAMES.length); i++) {
    await startBot(engine, joinSecret, BOT_NAMES[i] ?? `Bot ${i + 1}`, i);
  }
  return { roomId, joinSecret, adminSecret, contentKey: null };
}

export function stopDemo(roomId: string): void {
  const t = alarmTimers.get(roomId);
  if (t) clearInterval(t);
  alarmTimers.delete(roomId);
}

/** Pick a plausible card: mostly near the middle of the estimable deck, sometimes a special. */
export function botChoice(
  scale: readonly Card[],
  personality: number,
  rnd: () => number,
): string | null {
  const estimable = scale.filter((c) => c.kind !== 'special');
  if (estimable.length === 0) return null;
  const special = scale.filter((c) => c.kind === 'special');
  if (special.length > 0 && rnd() < 0.08)
    return special[Math.floor(rnd() * special.length)]?.value ?? null;
  const center = Math.floor(estimable.length * (0.35 + 0.1 * personality));
  const offset = Math.round((rnd() - 0.5) * 2);
  const idx = Math.max(0, Math.min(estimable.length - 1, center + offset));
  return estimable[idx]?.value ?? null;
}

async function startBot(
  engine: LoopbackEngine,
  joinSecret: string,
  name: string,
  personality: number,
): Promise<void> {
  const client: LoopbackClient = engine.connect();
  let votedFor = '';
  let pending: ReturnType<typeof setTimeout> | null = null;
  const consider = (room: RoomView) => {
    if (room.phase !== 'voting' || room.currentTaskId === null || room.round === null) return;
    const key = `${room.currentTaskId}:${room.round}`;
    if (votedFor === key || room.myVote !== null) return;
    votedFor = key;
    const value = botChoice(room.config.scale, personality, Math.random);
    if (value === null || typeof setTimeout === 'undefined') return;
    if (pending) clearTimeout(pending);
    const taskId = room.currentTaskId;
    const round = room.round;
    pending = setTimeout(
      () => {
        pending = null;
        void client.send({ type: 'vote', taskId, round, value });
      },
      1200 + Math.random() * 2500 + personality * 600,
    );
  };
  client.onMessage((msg) => {
    if (msg.type === 'welcome' || msg.type === 'state') consider(msg.room);
  });
  await client.send({ type: 'hello', v: 1, joinSecret, name, role: 'voter' });
}
