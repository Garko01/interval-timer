// usage:
// cd interval-timer
//cd npm run dev

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type MouseEvent,
} from "react";
import { FaPlay, FaPause, FaRedo, FaCog, FaStepBackward, FaStepForward, FaLock, FaUnlock } from "react-icons/fa";

import {
  DEFAULT_SETTINGS, buildSchedule, formatMMSS, requestWakeLock,
  countdownPip3, countdownPip2, countdownPip1,
  cueWorkStart, cueRestStart, cueEndLong,
  sendFinishNotification, PALETTE,
  vibrate, resumeAudioContext,
  saveSession, clearSession, loadSession, isSessionValid
} from './timer'
import type { Settings, IntervalDef, SessionState } from './timer'

function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)) } catch {}
  }, [key, state])
  return [state, setState] as const
}

function useFullscreen() {
  const enter = () => document.documentElement.requestFullscreen?.()
  const exit = () => document.exitFullscreen?.()
  const [isFS, setFS] = useState(!!document.fullscreenElement)
  useEffect(() => {
    const on = () => setFS(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  return { isFS, enter, exit }
}

function getRoundForIndex(schedule: IntervalDef[], idx: number, s: Settings) {
  let workCount = 0
  for (let i = 0; i <= idx && i < schedule.length; i++) {
    if (schedule[i].type === 'work') workCount++
  }
  const round = Math.min(Math.max(1, workCount), s.rounds)
  return round
}

function calculateTotalRemaining(schedule: IntervalDef[], currentIdx: number, currentRemaining: number) {
  let total = currentRemaining
  for (let i = currentIdx + 1; i < schedule.length; i++) {
    total += schedule[i].seconds
  }
  return total
}

// Auto-fit digits with exact pixel padding so we never overflow the viewport.
function useAutoFitDigits(config?: { sidePadEachVW?: number }) {
  // visual margin per side (in vw units)
  const sidePadEachVW = config?.sidePadEachVW ?? 4; // e.g., 4vw each side

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!wrapRef.current || !ghostRef.current) return;

  const compute = () => {
    requestAnimationFrame(() => {
      const el = wrapRef.current;
      const ghost = ghostRef.current;
      if (!el || !ghost) return;

      const vw = Math.max(320, document.documentElement.clientWidth || window.innerWidth);
      const vh = Math.max(320, document.documentElement.clientHeight || window.innerHeight);
      const isPortrait = vh >= vw;
      const isMobile   = vw < 768;
      const isTablet   = vw >= 768 && vw < 1200;
      const isDesktop  = vw >= 1200;

      // Baseline container constraints
      el.style.width = '100%';
      el.style.boxSizing = 'border-box';
      el.style.margin = '0 auto';
      el.style.maxWidth = '100%';
      el.style.overflowX = 'hidden';

      // Helper: measure ghost width at 100px
      const measureGhost = () => {
        const prevFS = ghost.style.fontSize;
        ghost.style.fontSize = '100px';
        const w = Math.max(1, ghost.getBoundingClientRect().width);
        ghost.style.fontSize = prevFS;
        return w;
      };

      const ghostW100 = measureGhost();

      // ===== MOBILE (fit to actual container) =====
      if (isMobile) {
        // real container width (includes its padding)
        const containerW = el.clientWidth || vw;

        // symmetric side padding in *pixels* (a bit smaller on tiny phones)
        const padPx =
          Math.round((containerW * (vw < 420 ? 0.015 : 0.02))) + 1; // +1px safety

        // expose it to CSS so both sides are *exactly* equal
        el.style.setProperty('--digits-pad', `${padPx}px`);

        // width fit using *container* width, not viewport width
        const usableW   = Math.max(1, containerW - padPx * 2);
        const sizeFromW = (100 * usableW * 0.985) / ghostW100; // tiny right-edge margin
        const sizeFromH = isPortrait ? vh * 0.34 : vh * 0.45;

        const initialPx = Math.max(48, Math.min(sizeFromW, sizeFromH, 720));
        el.style.setProperty('--digit-size', `${Math.round(initialPx)}px`);

        // verify after paint; if still a hair wide, shrink once
        requestAnimationFrame(() => {
          const valueEl = el.querySelector('.value') as HTMLElement | null;
          if (!valueEl) return;
          const valueW = valueEl.getBoundingClientRect().width;
          if (valueW > usableW) {
            const scale = (usableW / valueW) * 0.985;
            el.style.setProperty('--digit-size',
              `${Math.max(48, Math.floor(initialPx * scale))}px`);
          }
        });
        return;
      }

      // ===== TABLET / DESKTOP (keep larger look) =====
      const sidePadVW = isDesktop ? 0.8 : isTablet ? 1.2 : 1.5;
      const padPx = (sidePadVW / 100) * vw;
      el.style.paddingLeft  = `${padPx}px`;
      el.style.paddingRight = `${padPx}px`;

      const usableW   = Math.max(1, vw - padPx * 2);
      const sizeFromW = (100 * usableW * 0.99) / ghostW100; // tiny margin
      const sizeFromH = isDesktop ? vh * 0.68 : isTablet ? vh * 0.58 : vh * 0.50;

      const hardCap = isDesktop ? 1120 : 920;
      const sizePx = Math.max(48, Math.min(sizeFromW, sizeFromH, hardCap));
      el.style.setProperty('--digit-size', `${Math.round(sizePx)}px`);
    });
  };


    const ro = new ResizeObserver(compute);
    ro.observe(wrapRef.current!);
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    compute();

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, [sidePadEachVW]);

  return { wrapRef, ghostRef };
}

const selectFlag = 'selectAllOnFocus'
const handleNumericFocus = (e: FocusEvent<HTMLInputElement>) => {
  const input = e.currentTarget
  requestAnimationFrame(() => input.select())
  input.dataset[selectFlag] = '1'
}
const handleNumericMouseUp = (e: MouseEvent<HTMLInputElement>) => {
  const input = e.currentTarget
  if (input.dataset[selectFlag]) {
    e.preventDefault()
    delete input.dataset[selectFlag]
  }
}
const handleNumericBlur = (e: FocusEvent<HTMLInputElement>) => {
  delete e.currentTarget.dataset[selectFlag]
}

type NumberFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number
  onValueChange: (value: number) => void
}

function NumberField({
  value,
  onValueChange,
  min,
  max,
  onBlur: onBlurProp,
  onFocus: onFocusProp,
  onMouseUp: onMouseUpProp,
  type,
  ...rest
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string>(() => value.toString())
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) {
      setDraft(value.toString())
    }
  }, [value, editing])

  const minValue = typeof min === 'number' ? min : typeof min === 'string' && min !== '' ? Number(min) : undefined
  const maxValue = typeof max === 'number' ? max : typeof max === 'string' && max !== '' ? Number(max) : undefined

  const clampValue = (num: number) => {
    let next = num
    if (minValue !== undefined && next < minValue) next = minValue
    if (maxValue !== undefined && next > maxValue) next = maxValue
    return next
  }

  const commit = (nextDraft: string) => {
    if (nextDraft === '') {
      setDraft('')
      return
    }
    const parsed = Number(nextDraft)
    if (Number.isNaN(parsed)) {
      setDraft(nextDraft)
      return
    }
    const clamped = clampValue(parsed)
    const clampedStr = clamped.toString()
    setDraft(clampedStr)
    if (clamped !== value) {
      onValueChange(clamped)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    if (next === '') {
      setDraft('')
      return
    }

    const parsed = Number(next)
    if (Number.isNaN(parsed)) {
      setDraft(next)
      return
    }

    const clamped = clampValue(parsed)
    if (clamped !== parsed) {
      setDraft(clamped.toString())
      if (clamped !== value) {
        onValueChange(clamped)
      }
      return
    }

    setDraft(next)
    if (parsed !== value) {
      onValueChange(parsed)
    }
  }

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setEditing(true)
    handleNumericFocus(e)
    onFocusProp?.(e)
  }

  const handleMouseUp = (e: MouseEvent<HTMLInputElement>) => {
    handleNumericMouseUp(e)
    onMouseUpProp?.(e)
  }

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setEditing(false)
    if (draft === '') {
      setDraft(value.toString())
    } else {
      commit(draft)
    }
    handleNumericBlur(e)
    onBlurProp?.(e)
  }

  return (
    <input
      {...rest}
      type={type ?? 'number'}
      min={min}
      max={max}
      value={draft}
      onChange={handleChange}
      onFocus={handleFocus}
      onMouseUp={handleMouseUp}
      onBlur={handleBlur}
    />
  )
}

export default function App() {
  const [settings, setSettings] = useLocalStorage<Settings>('itimer.settings', DEFAULT_SETTINGS)
    const [presets, setPresets] = useLocalStorage<Record<string, Settings>>('itimer.presets', {});
  const [currentPresetName, setCurrentPresetName] = useState<string | null>(null);
  const schedule = useMemo(() => buildSchedule(settings), [settings])

  const [idx, setIdx] = useState(0)
  const [remaining, setRemaining] = useState(schedule[0]?.seconds ?? settings.workSeconds)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  const rafRef = useRef<number | null>(null)
  const lastTs = useRef<number | null>(null)
  const isResumingRef = useRef(false)

  const [showSettings, setShowSettings] = useState(false)
  const [showResume, setShowResume] = useState(false)
  const [savedSession, setSavedSession] = useState<SessionState | null>(null)
  const [locked, setLocked] = useState(false)

  // countdown-at-end refs
  const prevRemainingRef = useRef<number | null>(null)
  const played3Ref = useRef(false)
  const played2Ref = useRef(false)
  const played1Ref = useRef(false)

  // refs to avoid stale closures in RAF loop
  const settingsRef = useRef(settings)
  const scheduleRef = useRef(schedule)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    scheduleRef.current = schedule
  }, [schedule])

  const current: IntervalDef = schedule[idx] ?? {
    type: 'work',
    name: 'WORK',
    seconds: settings.workSeconds,
    color: PALETTE.work,
  }
  const round = useMemo(() => getRoundForIndex(schedule, idx, settings), [schedule, idx, settings])

  // keep screen awake follows 'running' and the toggle
  useEffect(() => {
    requestWakeLock(settings.wakeLock && running);
    return () => { requestWakeLock(false); }; // cleanup on unmount
  }, [settings.wakeLock, running]);

  // When interval changes, reset countdown flags and baseline
  useEffect(() => {
    played3Ref.current = false
    played2Ref.current = false
    played1Ref.current = false
    prevRemainingRef.current = current.seconds
  }, [current.seconds])

  // Keep remaining in sync when interval changes (unless resuming)
  useEffect(() => {
    if (isResumingRef.current) {
      isResumingRef.current = false
      return
    }
    setRemaining(current.seconds)
  }, [current.seconds])

  // Tick loop with T-3 / T-2 / T-1 pips
  useEffect(() => {
    if (!running) return

    function tick(ts: number) {
      if (lastTs.current === null) lastTs.current = ts
      const dt = (ts - lastTs.current) / 1000
      lastTs.current = ts

      setRemaining(prev => {
        const prevVal = prevRemainingRef.current ?? prev
        const next = Math.max(0, prev - dt)

        // countdown pips in last 3 seconds of CURRENT interval
        const currentSettings = settingsRef.current
        if (!currentSettings.mute && currentSettings.precount321) {
          if (!played3Ref.current && prevVal > 3 && next <= 3) { countdownPip3(); played3Ref.current = true }
          if (!played2Ref.current && prevVal > 2 && next <= 2) { countdownPip2(); played2Ref.current = true }
          if (!played1Ref.current && prevVal > 1 && next <= 1) { countdownPip1(); played1Ref.current = true }
        }

        prevRemainingRef.current = next

        if (next === 0) {
          goToNextInterval();
          return 0;
        }
        return next
      })

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [running])

  const idxRef = useRef(0);
  useEffect(() => { idxRef.current = idx; }, [idx]);

  function goToNextInterval() {
    const nextIndex = idxRef.current + 1;
    const currentSchedule = scheduleRef.current;
    const currentSettings = settingsRef.current;

    // Finished
    if (nextIndex >= currentSchedule.length) {
      setDone(true);
      if (currentSettings.notifications.finish) sendFinishNotification('Interval Timer');
      if (!currentSettings.mute) cueEndLong();
      if (currentSettings.vibrate) vibrate([200, 100, 200, 100, 400]); // distinct pattern
      setRunning(false);
      return;
    }

    // Move index & seconds together (single frame)
    const nextSecs = currentSchedule[nextIndex].seconds;
    setIdx(nextIndex);
    setRemaining(nextSecs);
    prevRemainingRef.current = nextSecs;
    played3Ref.current = played2Ref.current = played1Ref.current = false;

    // Play audio and vibration cues on transition
    const t = currentSchedule[nextIndex].type;
    if (!currentSettings.mute) {
      t === 'work' ? cueWorkStart() : cueRestStart();
    }
    if (currentSettings.vibrate) {
      if (t === 'work') vibrate(300);          // single long buzz
      else if (t === 'rest') vibrate([100, 50, 100]); // short double buzz
    }
  }

  function start() {
    setDone(false)
    lastTs.current = null
    // Resume audio context on user gesture (required by modern browsers)
    resumeAudioContext()
    // No separate 3-2-1 here; countdown plays at end of each interval.
    setRunning(true)
  }

  function pause() {
    setRunning(false)
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }

  function toggle() { running ? pause() : start() }

  function restart() {
    pause()
    setIdx(0)
    setRemaining(schedule[0]?.seconds ?? settings.workSeconds)
    setDone(false)
    lastTs.current = null
    played3Ref.current = false
    played2Ref.current = false
    played1Ref.current = false
    prevRemainingRef.current = schedule[0]?.seconds ?? settings.workSeconds
  }

  function resetCurrentInterval() {
    const currentSchedule = scheduleRef.current;
    const currentIdx = idxRef.current;
    const currentInterval = currentSchedule[currentIdx];

    if (!currentInterval) return;

    // Reset current interval time to full duration
    setRemaining(currentInterval.seconds);
    prevRemainingRef.current = currentInterval.seconds;
    played3Ref.current = false;
    played2Ref.current = false;
    played1Ref.current = false;
    lastTs.current = null; // Reset timestamp for smooth continuation
  }

  function handleResumeSession() {
    if (!savedSession) return
    isResumingRef.current = true
    setIdx(savedSession.idx)
    setRemaining(savedSession.remaining)
    setDone(false)
    prevRemainingRef.current = savedSession.remaining
    setShowResume(false)
    setSavedSession(null)
  }

  function handleStartFresh() {
    clearSession()
    restart()
    setShowResume(false)
    setSavedSession(null)
  }

  function handleManualResume() {
    const session = loadSession()
    if (session && isSessionValid(session, settings)) {
      setSavedSession(session)
      setShowResume(true)
    }
  }

  // Interval navigation handlers
  function handlePrevInterval() {
    const prevIdx = idx - 1
    if (prevIdx < 0) return

    const targetInterval = schedule[prevIdx]
    if (!targetInterval) return

    // Update interval state - RAF loop will pick up new values
    setIdx(prevIdx)
    setRemaining(targetInterval.seconds)
    prevRemainingRef.current = targetInterval.seconds
    played3Ref.current = false
    played2Ref.current = false
    played1Ref.current = false
    setDone(false)
    lastTs.current = null // Reset timestamp for smooth continuation
  }

  function handleNextInterval() {
    const nextIdx = idx + 1
    if (nextIdx >= schedule.length) return

    const targetInterval = schedule[nextIdx]
    if (!targetInterval) return

    // Update interval state - RAF loop will pick up new values
    setIdx(nextIdx)
    setRemaining(targetInterval.seconds)
    prevRemainingRef.current = targetInterval.seconds
    played3Ref.current = false
    played2Ref.current = false
    played1Ref.current = false
    setDone(false)
    lastTs.current = null // Reset timestamp for smooth continuation
  }

  function handleLock() {
    setLocked(true)
    setShowSettings(false) // Close settings if open
  }

  function handleUnlock() {
    setLocked(false)
  }

  const { isFS, enter, exit } = useFullscreen()

  // Track if this is first mount to avoid restart on initial load
  const isFirstMount = useRef(true)

  // Check for saved session on mount
  useEffect(() => {
    const session = loadSession()
    if (session && isSessionValid(session, settings)) {
      setSavedSession(session)
      setShowResume(true)
    }
  }, [settings])

  // Rebuild/restart if structural settings change (but not on first mount)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    restart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule])

  // Auto-save session state on changes
  useEffect(() => {
    // Only save if timer is running or paused (not initial state)
    if (idx > 0 || (idx === 0 && remaining !== schedule[0]?.seconds)) {
      saveSession({
        idx,
        remaining,
        round,
        timestamp: Date.now(),
        settings,
        scheduleLength: schedule.length,
      })
    }
  }, [idx, remaining, running, round, settings, schedule])

  // Periodic backup saves while running (every 5 seconds)
  useEffect(() => {
    if (!running) return

    const intervalId = setInterval(() => {
      saveSession({
        idx,
        remaining,
        round,
        timestamp: Date.now(),
        settings,
        scheduleLength: schedule.length,
      })
    }, 5000)

    return () => clearInterval(intervalId)
  }, [running, idx, remaining, round, settings, schedule])

  // Clear session on completion
  useEffect(() => {
    if (done) {
      clearSession()
    }
  }, [done])

  const { wrapRef, ghostRef } = useAutoFitDigits();

  return (
    <div className="container">
      {/* assistive-only announcement */}
      <span className="sr-only" aria-live="polite">
        {done ? 'Workout complete' : ''}
      </span>
      
      {currentPresetName && (
        <div className="float-tl">
          <div className="preset-badge" title={`Preset: ${currentPresetName}`}>
            {currentPresetName}
          </div>
        </div>
      )}

      <div className="float-tc">
        <div className="total-time">
          {formatMMSS(Math.ceil(calculateTotalRemaining(schedule, idx, remaining)))}
        </div>
      </div>

      <div className="float-tr">
        <button
          className="circle iconbtn"
          onClick={() => setShowSettings(true)}
          title="Settings"
          aria-label="Settings"
        >
          <FaCog />
        </button>
      </div>

      <main className="main">
        <div className="timerCard" style={{ borderColor: current.color }}>
          <div className="labels">
            <div className="roundLabel">Round {round} / {settings.rounds}</div>
            <div className="intervalLabel" style={{ color: current.color }}>{current.name}</div>
          </div>
          
          <div className="digits" ref={wrapRef}>
            <span className="ghost" ref={ghostRef}>88:88</span>
            <span className="value">{formatMMSS(Math.ceil(remaining))}</span>
          </div>
          <div className="controls" style={locked ? { position: 'relative', zIndex: 10000 } : {}}>
            <button
              className="controlBtn resetBtn"
              onClick={resetCurrentInterval}
              disabled={locked}
              aria-label="Reset current interval"
              title="Reset current interval"
            >
              <FaRedo />
            </button>

            <button
              className="controlBtn navBtn"
              onClick={handlePrevInterval}
              disabled={locked || idx <= 0}
              aria-label="Previous interval"
              title="Previous interval"
            >
              <FaStepBackward />
            </button>

            <button
              className="controlBtn playPauseBtn"
              onClick={toggle}
              disabled={locked}
              aria-label={running ? "Pause" : "Start"}
              title={running ? "Pause" : "Start"}
            >
              {running ? <FaPause /> : <FaPlay />}
            </button>

            <button
              className="controlBtn navBtn"
              onClick={handleNextInterval}
              disabled={locked || idx >= schedule.length - 1}
              aria-label="Next interval"
              title="Next interval"
            >
              <FaStepForward />
            </button>

            <button
              className="controlBtn lockBtn"
              onClick={locked ? handleUnlock : handleLock}
              aria-label={locked ? "Unlock page" : "Lock page"}
              title={locked ? "Unlock page" : "Lock page"}
            >
              {locked ? <FaLock /> : <FaUnlock />}
            </button>
          </div>
        </div>
      </main>

      <div className="float-br">
        <button className="circle iconbtn" onClick={() => isFS ? exit() : enter()} title={isFS ? 'Exit Fullscreen' : 'Enter Fullscreen'}>⛶</button>
      </div>

      {!running && !done && loadSession() && (
        <div className="float-bl">
          <button
            className="circle iconbtn"
            onClick={handleManualResume}
            title="Resume last session"
            aria-label="Resume last session"
          >
            ⏎
          </button>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          presets={presets}
          onPresetsChange={setPresets}
          onClose={() => setShowSettings(false)}
          onChange={setSettings}
          currentPresetName={currentPresetName}
          onPresetNameChange={setCurrentPresetName}
        />
      )}

      {showResume && savedSession && (
        <ResumeModal
          session={savedSession}
          schedule={schedule}
          onResume={handleResumeSession}
          onStartFresh={handleStartFresh}
        />
      )}

      {locked && <LockOverlay />}
    </div>
  )
}

function LockOverlay() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'transparent',
      }}
      aria-label="Page is locked"
    />
  )
}

function ResumeModal({
  session,
  schedule,
  onResume,
  onStartFresh,
}: {
  session: SessionState
  schedule: IntervalDef[]
  onResume: () => void
  onStartFresh: () => void
}) {
  const currentInterval = schedule[session.idx]
  const timeAgo = Math.floor((Date.now() - session.timestamp) / 1000)

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modalCard">
        <div className="modalHeader">
          <h3>Resume Session?</h3>
        </div>

        <div className="modalBody">
          <p style={{ marginBottom: '1rem' }}>
            You have a saved session from {timeAgo < 60 ? 'just now' : `${Math.floor(timeAgo / 60)} min ago`}.
          </p>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Round:</strong> {session.round} / {session.settings.rounds}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Interval:</strong> {currentInterval?.name || 'Unknown'}
            </div>
            <div>
              <strong>Time remaining:</strong> {formatMMSS(Math.ceil(session.remaining))}
            </div>
          </div>

          <p style={{ fontSize: '0.9rem', color: '#999' }}>
            Choose to resume where you left off, or start a fresh session.
          </p>
        </div>

        <div className="modalFooter">
          <button className="iconbtn" onClick={onStartFresh}>Start Fresh</button>
          <button className="iconbtn" onClick={onResume} style={{ background: '#3AA7E9' }}>Resume</button>
        </div>
      </div>
    </div>
  )
}

function SettingsModal({
  settings,
  presets,
  onPresetsChange,
  onChange,
  onClose,
  currentPresetName,
  onPresetNameChange,
}: {
  settings: Settings;
  presets: Record<string, Settings>;
  onPresetsChange: (map: Record<string, Settings>) => void;
  onChange: (s: Settings | ((p: Settings) => Settings)) => void;
  onClose: () => void;
  currentPresetName: string | null;
  onPresetNameChange: (name: string | null) => void;
}) {
  const [local, setLocal] = useState<Settings>(settings);
  const [newName, setNewName] = useState('');
  const [editingPreset, setEditingPreset] = useState<string | null>(null);

  function handleSavePreset() {
    const name = newName.trim();
    if (!name) return;

    // Prevent name collision during rename
    if (editingPreset && name !== editingPreset && presets[name]) {
      alert(`Preset "${name}" already exists`);
      return;
    }

    const updated = { ...presets };

    // Remove old name if renamed
    if (editingPreset && name !== editingPreset) {
      delete updated[editingPreset];
    }

    updated[name] = local;
    onPresetsChange(updated);

    setNewName('');
    setEditingPreset(null);
  }

  function handleEditPreset(name: string) {
    const preset = presets[name];
    if (!preset) return;
    setLocal(preset);
    setNewName(name);
    setEditingPreset(name);
  }

  function handleLoadPreset(name: string) {
    const preset = presets[name];
    if (!preset) return;
    onChange(preset);
    onPresetNameChange(name);
    onClose();
  }

  function handleCancelEdit() {
    setNewName('');
    setEditingPreset(null);
    setLocal(settings);
  }

  function handleDeletePreset(name: string) {
    if (!confirm(`Delete preset "${name}"?`)) return;
    const updated = { ...presets };
    delete updated[name];
    onPresetsChange(updated);
  }

  useEffect(() => setLocal(settings), [settings]);

  function save() {
    onChange(local);
    // Clear preset name if settings were manually changed
    if (currentPresetName) {
      const loadedPreset = presets[currentPresetName];
      if (!loadedPreset || JSON.stringify(loadedPreset) !== JSON.stringify(local)) {
        onPresetNameChange(null);
      }
    }
    onClose();
  }

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modalCard">
        <div className="modalHeader">
          <h3>Timer Settings</h3>
          <button className="iconbtn" onClick={onClose}>✖</button>
        </div>

        <div className="modalBody">
          {/* === PRESETS === */}
          <section>
            <h4>Presets</h4>
            <div className="row">
              <input
                className="input"
                placeholder={editingPreset ? "Preset name" : "New preset name"}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button className="iconbtn" onClick={handleSavePreset}>
                {editingPreset ? 'Update' : 'Save'}
              </button>
              {editingPreset && (
                <button className="iconbtn" onClick={handleCancelEdit}>Cancel</button>
              )}
            </div>

            {Object.keys(presets).length === 0 ? (
              <p className="hint" style={{ marginTop: 8 }}>No presets saved yet.</p>
            ) : (
              <ul className="presetList">
                {Object.keys(presets).map((name) => (
                  <li key={name} className="presetItem">
                    <span>{name}</span>
                    <div className="presetActions">
                      <button className="iconbtn" onClick={() => handleLoadPreset(name)}>Load</button>
                      <button className="iconbtn" onClick={() => handleEditPreset(name)}>Edit</button>
                      <button className="iconbtn" onClick={() => handleDeletePreset(name)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* === STRUCTURE === */}
          <section>
            <h4>Structure</h4>

            <div className="row">
              <label className="label labelFixed">Rounds</label>
              <NumberField
                className="input"
                min={1}
                max={100}
                value={local.rounds}
                onValueChange={(value) => setLocal({ ...local, rounds: value })}
              />
            </div>

            <div className="row">
              <label className="label labelFixed">Include Warmup</label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.includeWarmup}
                  onChange={(e) => setLocal({ ...local, includeWarmup: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>

            <div className="row">
              <label className="label labelFixed">Warmup (mm:ss)</label>
              <MmSsInput
                value={local.warmupSeconds}
                onChange={(v) => setLocal({ ...local, warmupSeconds: v })}
                disabled={!local.includeWarmup}
              />
            </div>

            <div className="row">
              <label className="label labelFixed">Include Cooldown</label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.includeCooldown}
                  onChange={(e) => setLocal({ ...local, includeCooldown: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>

            <div className="row">
              <label className="label labelFixed">Cooldown (mm:ss)</label>
              <MmSsInput
                value={local.cooldownSeconds}
                onChange={(v) => setLocal({ ...local, cooldownSeconds: v })}
                disabled={!local.includeCooldown}
              />
            </div>
          </section>

          {/* === INTERVALS === */}
          <section>
            <h4>Intervals</h4>

            <div className="row">
              <label className="label labelFixed">Work (mm:ss)</label>
              <MmSsInput
                value={local.workSeconds}
                onChange={(v) => setLocal({ ...local, workSeconds: v })}
              />
            </div>

            <div className="row">
              <label className="label labelFixed">Rest (mm:ss)</label>
              <MmSsInput
                value={local.restSeconds}
                onChange={(v) => setLocal({ ...local, restSeconds: v })}
              />
            </div>

            <div className="row">
              <label className="label labelFixed">Pre-count 3–2–1</label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.precount321}
                  onChange={(e) => setLocal({ ...local, precount321: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>

            <div className="row">
              <label className="label labelFixed">Mute sounds</label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.mute}
                  onChange={(e) => setLocal({ ...local, mute: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>
          </section>

          {/* === POWER === */}
          <section>
            <h4>Power</h4>

            <div className="row">
              <label className="label labelFixed">Keep screen awake</label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.wakeLock}
                  onChange={(e) => setLocal({ ...local, wakeLock: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>

            <div className="row">
              <label className="label labelFixed">Vibrate on transitions</label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.vibrate}
                  onChange={(e) => setLocal({ ...local, vibrate: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>

            <div className="row">
              <label className="label labelFixed">Finish notification</label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.notifications.finish}
                  onChange={(e) =>
                    setLocal({
                      ...local,
                      notifications: { ...local.notifications, finish: e.target.checked },
                    })
                  }
                />
                <span className="slider" />
              </label>
            </div>
          </section>
        </div>

        {/* === FOOTER === */}
        <div className="modalFooter">
          <button className="iconbtn" onClick={onClose}>Cancel</button>
          <button className="iconbtn" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }

function MmSsInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const m = Math.floor(value / 60)
  const s = value % 60
  const [mm, setMM] = useState(m)
  const [ss, setSS] = useState(s)

  useEffect(() => {
    setMM(Math.floor(value / 60))
    setSS(value % 60)
  }, [value])

  useEffect(() => {
    const totalSeconds = clamp(mm, 0, 59) * 60 + clamp(ss, 0, 59)
    onChange(totalSeconds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mm, ss])

  return (
    <div className="mmss">
      <NumberField className="input" min={0} max={59} value={mm} disabled={disabled} onValueChange={setMM} />
      <span>:</span>
      <NumberField className="input" min={0} max={59} value={ss} disabled={disabled} onValueChange={setSS} />
    </div>
  )
}

