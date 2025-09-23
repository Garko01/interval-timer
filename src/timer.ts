export type IntervalType = 'warmup' | 'work' | 'rest' | 'cooldown'

export interface IntervalDef {
  type: IntervalType
  name: string
  seconds: number
  color: string
}

export interface Settings {
  rounds: number
  includeWarmup: boolean
  includeCooldown: boolean
  warmupSeconds: number
  cooldownSeconds: number
  workSeconds: number
  restSeconds: number
  precount321: boolean
  mute: boolean
  wakeLock: boolean
  notifications: { finish: boolean; perInterval: boolean }
}

export const DEFAULT_SETTINGS: Settings = {
  rounds: 5,
  includeWarmup: false,
  includeCooldown: false,
  warmupSeconds: 120,
  cooldownSeconds: 120,
  workSeconds: 30,
  restSeconds: 10,
  precount321: true,
  mute: false,
  wakeLock: false,
  notifications: { finish: true, perInterval: false },
}

export const PALETTE = {
  warmup:  '#A33AA6',
  work:    '#FF2000',
  rest:    '#3AA7E9',
  cooldown:'#00A98F',
} as const

export function buildSchedule(s: Settings): IntervalDef[] {
  const core: IntervalDef[] = []
  const round: IntervalDef[] = [
    { type:'work', name:'WORK', seconds: s.workSeconds, color: PALETTE.work },
    { type:'rest', name:'REST', seconds: s.restSeconds, color: PALETTE.rest },
  ]
  for (let r = 0; r < s.rounds; r++) core.push(...round)
  if (core.length > 0 && core[core.length - 1].type === 'rest') core.pop()

  const full: IntervalDef[] = []
  if (s.includeWarmup) full.push({ type:'warmup', name:'WARMUP', seconds: s.warmupSeconds, color: PALETTE.warmup })
  full.push(...core)
  if (s.includeCooldown) full.push({ type:'cooldown', name:'COOLDOWN', seconds: s.cooldownSeconds, color: PALETTE.cooldown })
  return full
}

export function formatMMSS(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// --- Web Audio context ---
let audioCtx: AudioContext | undefined
function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  return audioCtx
}

/**
 * Digital sport-watch style pip
 * Square wave through a tight band-pass → crisp, piercing beep.
 */
function digitalBeep(opts: {
  freq: number
  durationMs?: number
  startAt?: number
  gain?: number
  sweepToHz?: number
}) {
  const {
    freq,
    durationMs = 140,
    startAt = 0,
    gain = 0.80,
    sweepToHz,
  } = opts

  const ac = ctx()
  const t0 = ac.currentTime + startAt
  const tEnd = t0 + durationMs / 1000

  const osc = ac.createOscillator()
  osc.type = 'square'
  osc.frequency.value = freq
  if (typeof sweepToHz === 'number') {
    osc.frequency.setValueAtTime(freq, t0)
    osc.frequency.linearRampToValueAtTime(sweepToHz, tEnd)
  }

  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 3000
  bp.Q.value = 8 // tight band for a very digital tone

  const g = ac.createGain()
  g.gain.setValueAtTime(1e-5, t0)                // micro fade-in to avoid click
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(1e-4, tEnd)

  osc.connect(bp).connect(g).connect(ac.destination)
  osc.start(t0)
  osc.stop(tEnd + 0.02)
}

/** Countdown pips (trigger at T-3, T-2, T-1 of the CURRENT interval) */
export function countdownPip3() { digitalBeep({ freq: 2200, sweepToHz: 2200 }) }
export function countdownPip2() { digitalBeep({ freq: 2200, sweepToHz: 2200 }) }
export function countdownPip1() { digitalBeep({ freq: 2200, sweepToHz: 2200 }) }

/** Start cues for the NEXT interval (played at the moment of switch) */
export function cueWorkStart() {
  // Same tone for work/rest; work = two pips
  digitalBeep({ freq: 2500, durationMs: 120, startAt: 0.00 })
  digitalBeep({ freq: 2500, durationMs: 120, startAt: 0.16 })
}

export function cueRestStart() {
  // Same tone; rest = one pip
  digitalBeep({ freq: 2500, durationMs: 120, startAt: 0.00 })
}

/** End of workout (played AFTER the last interval’s T-1 pip) */
export function cueEndLong() {
  digitalBeep({ freq: 2200, sweepToHz: 2200, durationMs: 200, startAt: 0.00 })
  digitalBeep({ freq: 2200, sweepToHz: 2200, durationMs: 500, startAt: 0.10 })
  digitalBeep({ freq: 2200, sweepToHz: 2200, durationMs: 1500, startAt: 0.30 })
}

// --- Wake Lock ---
let wakeLock: any | null = null;
let visibilityHandler: (() => void) | null = null;

export async function requestWakeLock(enabled: boolean) {
  try {
    // If turning OFF
    if (!enabled) {
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }
      await wakeLock?.release?.();
      wakeLock = null;
      return false;
    }

    // Turning ON
    if (!('wakeLock' in navigator)) return false; // unsupported (iOS Safari < 16.4, some desktop browsers)

    // Request (or re-request) the screen lock
    wakeLock = await (navigator as any).wakeLock.request('screen');

    // Re-acquire when tab becomes visible again
    visibilityHandler ??= async () => {
      if (document.visibilityState === 'visible' && (!wakeLock || wakeLock.released)) {
        try { wakeLock = await (navigator as any).wakeLock.request('screen'); } catch {}
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    // Optional: observe releases
    wakeLock.addEventListener?.('release', () => { /* you could log here */ });

    return true;
  } catch {
    return false; // permission denied or user gesture missing
  }
}

// --- Notifications ---
export function canNotify()    { return 'Notification' in window }
export function permission()   { return (window as any).Notification?.permission as NotificationPermission }
export async function ensureNotifyPermission(): Promise<boolean> {
  if (!canNotify()) return false
  if (permission() === 'granted') return true
  if (permission() === 'denied')  return false
  const res = await Notification.requestPermission()
  return res === 'granted'
}
export function sendFinishNotification(title: string) {
  if (!canNotify()) return
  if (permission() !== 'granted') return
  new Notification(title, { body: 'Workout complete!', silent: false })
}
