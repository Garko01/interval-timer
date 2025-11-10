import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SessionState,
  Settings,
  DEFAULT_SETTINGS,
  saveSession,
  loadSession,
  clearSession,
  isSessionValid,
  buildSchedule,
} from '../timer'

describe('Session Persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('SessionState interface', () => {
    it('should have correct properties', () => {
      const session: SessionState = {
        idx: 0,
        remaining: 30,
        round: 1,
        timestamp: Date.now(),
        settings: DEFAULT_SETTINGS,
        scheduleLength: 9,
      }

      expect(session).toHaveProperty('idx')
      expect(session).toHaveProperty('remaining')
      expect(session).toHaveProperty('round')
      expect(session).toHaveProperty('timestamp')
      expect(session).toHaveProperty('settings')
      expect(session).toHaveProperty('scheduleLength')
    })
  })

  describe('saveSession', () => {
    it('should save session to localStorage', () => {
      const session: SessionState = {
        idx: 3,
        remaining: 15,
        round: 2,
        timestamp: Date.now(),
        settings: DEFAULT_SETTINGS,
        scheduleLength: 9,
      }

      saveSession(session)

      const saved = localStorage.getItem('interval-timer-session')
      expect(saved).toBeTruthy()
      expect(JSON.parse(saved!)).toEqual(session)
    })

    it('should handle localStorage errors gracefully', () => {
      const session: SessionState = {
        idx: 0,
        remaining: 30,
        round: 1,
        timestamp: Date.now(),
        settings: DEFAULT_SETTINGS,
        scheduleLength: 9,
      }

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage full')
      })

      expect(() => saveSession(session)).not.toThrow()
    })
  })

  describe('loadSession', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('should load session from localStorage', () => {
      const session: SessionState = {
        idx: 5,
        remaining: 20,
        round: 3,
        timestamp: Date.now(),
        settings: DEFAULT_SETTINGS,
        scheduleLength: 9,
      }

      localStorage.setItem('interval-timer-session', JSON.stringify(session))

      const loaded = loadSession()
      expect(loaded).toEqual(session)
    })

    it('should return null if no session exists', () => {
      const loaded = loadSession()
      expect(loaded).toBeNull()
    })

    it('should return null if localStorage has invalid JSON', () => {
      localStorage.setItem('interval-timer-session', 'invalid json')
      const loaded = loadSession()
      expect(loaded).toBeNull()
    })

    it('should handle localStorage errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage error')
      })

      expect(() => loadSession()).not.toThrow()
      expect(loadSession()).toBeNull()
    })
  })

  describe('clearSession', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('should remove session from localStorage', () => {
      const session: SessionState = {
        idx: 0,
        remaining: 30,
        round: 1,
        timestamp: Date.now(),
        settings: DEFAULT_SETTINGS,
        scheduleLength: 9,
      }

      localStorage.setItem('interval-timer-session', JSON.stringify(session))
      expect(localStorage.getItem('interval-timer-session')).toBeTruthy()

      clearSession()
      expect(localStorage.getItem('interval-timer-session')).toBeNull()
    })

    it('should handle localStorage errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('localStorage error')
      })

      expect(() => clearSession()).not.toThrow()
    })
  })

  describe('isSessionValid', () => {
    const createValidSession = (overrides?: Partial<SessionState>): SessionState => {
      const settings = DEFAULT_SETTINGS
      const schedule = buildSchedule(settings)

      return {
        idx: 0,
        remaining: 30,
        round: 1,
        timestamp: Date.now(),
        settings: settings,
        scheduleLength: schedule.length,
        ...overrides,
      }
    }

    it('should return true for valid session', () => {
      const session = createValidSession()
      const result = isSessionValid(session, DEFAULT_SETTINGS)
      expect(result).toBe(true)
    })

    it('should return false if rounds changed', () => {
      const session = createValidSession()
      const newSettings: Settings = { ...DEFAULT_SETTINGS, rounds: 10 }
      const result = isSessionValid(session, newSettings)
      expect(result).toBe(false)
    })

    it('should return false if includeWarmup changed', () => {
      const session = createValidSession()
      const newSettings: Settings = { ...DEFAULT_SETTINGS, includeWarmup: true }
      const result = isSessionValid(session, newSettings)
      expect(result).toBe(false)
    })

    it('should return false if includeCooldown changed', () => {
      const session = createValidSession()
      const newSettings: Settings = { ...DEFAULT_SETTINGS, includeCooldown: true }
      const result = isSessionValid(session, newSettings)
      expect(result).toBe(false)
    })

    it('should return false if warmupSeconds changed', () => {
      const session = createValidSession()
      const newSettings: Settings = { ...DEFAULT_SETTINGS, warmupSeconds: 180 }
      const result = isSessionValid(session, newSettings)
      expect(result).toBe(false)
    })

    it('should return false if cooldownSeconds changed', () => {
      const session = createValidSession()
      const newSettings: Settings = { ...DEFAULT_SETTINGS, cooldownSeconds: 180 }
      const result = isSessionValid(session, newSettings)
      expect(result).toBe(false)
    })

    it('should return false if workSeconds changed', () => {
      const session = createValidSession()
      const newSettings: Settings = { ...DEFAULT_SETTINGS, workSeconds: 45 }
      const result = isSessionValid(session, newSettings)
      expect(result).toBe(false)
    })

    it('should return false if restSeconds changed', () => {
      const session = createValidSession()
      const newSettings: Settings = { ...DEFAULT_SETTINGS, restSeconds: 15 }
      const result = isSessionValid(session, newSettings)
      expect(result).toBe(false)
    })

    it('should return false if schedule length does not match', () => {
      const session = createValidSession({ scheduleLength: 999 })
      const result = isSessionValid(session, DEFAULT_SETTINGS)
      expect(result).toBe(false)
    })

    it('should return false if index is negative', () => {
      const session = createValidSession({ idx: -1 })
      const result = isSessionValid(session, DEFAULT_SETTINGS)
      expect(result).toBe(false)
    })

    it('should return false if index is out of range', () => {
      const session = createValidSession({ idx: 100 })
      const result = isSessionValid(session, DEFAULT_SETTINGS)
      expect(result).toBe(false)
    })

    it('should return false if session is too old (>24 hours)', () => {
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      const session = createValidSession({ timestamp: oldTimestamp })
      const result = isSessionValid(session, DEFAULT_SETTINGS)
      expect(result).toBe(false)
    })

    it('should return true for session at 23 hours old', () => {
      const timestamp = Date.now() - (23 * 60 * 60 * 1000) // 23 hours ago
      const session = createValidSession({ timestamp })
      const result = isSessionValid(session, DEFAULT_SETTINGS)
      expect(result).toBe(true)
    })

    it('should validate session with warmup and cooldown', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        includeWarmup: true,
        includeCooldown: true,
      }
      const schedule = buildSchedule(settings)
      const session = createValidSession({
        settings,
        scheduleLength: schedule.length,
      })

      const result = isSessionValid(session, settings)
      expect(result).toBe(true)
    })
  })
})
