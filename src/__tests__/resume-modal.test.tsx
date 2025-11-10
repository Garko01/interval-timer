import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../App'
import { saveSession, clearSession, DEFAULT_SETTINGS, buildSchedule } from '../timer'

describe('Resume Modal', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should show resume modal when valid session exists on mount', () => {
    const schedule = buildSchedule(DEFAULT_SETTINGS)
    const session = {
      idx: 3,
      remaining: 15,
      round: 2,
      timestamp: Date.now(),
      settings: DEFAULT_SETTINGS,
      scheduleLength: schedule.length,
    }

    saveSession(session)

    render(<App />)

    expect(screen.getByText(/Resume Session/i)).toBeTruthy()
    expect(screen.getByText(/Round:/i)).toBeTruthy()
  })

  it('should not show resume modal when no session exists', () => {
    render(<App />)

    expect(screen.queryByText(/Resume Session/i)).toBeNull()
  })

  it('should show interval details in resume modal', () => {
    const schedule = buildSchedule(DEFAULT_SETTINGS)
    const session = {
      idx: 2,
      remaining: 20,
      round: 2,
      timestamp: Date.now(),
      settings: DEFAULT_SETTINGS,
      scheduleLength: schedule.length,
    }

    saveSession(session)

    render(<App />)

    expect(screen.getByText(/Round:/i)).toBeTruthy()
    expect(screen.getByText(/Interval:/i)).toBeTruthy()
    expect(screen.getByText(/Time remaining:/i)).toBeTruthy()
  })

  it('should resume session when Resume button clicked', () => {
    const schedule = buildSchedule(DEFAULT_SETTINGS)
    const session = {
      idx: 3,
      remaining: 15,
      round: 2,
      timestamp: Date.now(),
      settings: DEFAULT_SETTINGS,
      scheduleLength: schedule.length,
    }

    saveSession(session)

    render(<App />)

    // Find the button within the modal
    const modal = screen.getByRole('dialog')
    const resumeButton = modal.querySelector('button[style*="background"]') as HTMLElement
    fireEvent.click(resumeButton)

    // Modal should close
    expect(screen.queryByText(/Resume Session/i)).toBeNull()
  })

  it('should start fresh when Start Fresh button clicked', () => {
    const schedule = buildSchedule(DEFAULT_SETTINGS)
    const session = {
      idx: 3,
      remaining: 15,
      round: 2,
      timestamp: Date.now(),
      settings: DEFAULT_SETTINGS,
      scheduleLength: schedule.length,
    }

    saveSession(session)

    render(<App />)

    const startFreshButton = screen.getByText(/Start Fresh/i)
    fireEvent.click(startFreshButton)

    // Modal should close
    expect(screen.queryByText(/Resume Session/i)).toBeNull()

    // Session should be cleared
    const clearedSession = localStorage.getItem('interval-timer-session')
    expect(clearedSession).toBeNull()
  })

  it('should not show resume modal for invalid session', () => {
    const schedule = buildSchedule(DEFAULT_SETTINGS)
    const oldSession = {
      idx: 3,
      remaining: 15,
      round: 2,
      timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      settings: DEFAULT_SETTINGS,
      scheduleLength: schedule.length,
    }

    saveSession(oldSession)

    render(<App />)

    // Should not show resume modal for expired session
    expect(screen.queryByText(/Resume Session/i)).toBeNull()
  })

  it('should not show resume modal when settings changed', () => {
    const schedule = buildSchedule(DEFAULT_SETTINGS)
    const session = {
      idx: 3,
      remaining: 15,
      round: 2,
      timestamp: Date.now(),
      settings: { ...DEFAULT_SETTINGS, rounds: 10 }, // Different settings
      scheduleLength: schedule.length,
    }

    saveSession(session)

    render(<App />)

    // Should not show resume modal when settings don't match
    expect(screen.queryByText(/Resume Session/i)).toBeNull()
  })

  it('should show time ago in resume modal', () => {
    const schedule = buildSchedule(DEFAULT_SETTINGS)
    const session = {
      idx: 2,
      remaining: 20,
      round: 2,
      timestamp: Date.now() - 30000, // 30 seconds ago
      settings: DEFAULT_SETTINGS,
      scheduleLength: schedule.length,
    }

    saveSession(session)

    render(<App />)

    expect(screen.getByText(/just now/i)).toBeTruthy()
  })

  it('should show time in minutes when more than 60 seconds ago', () => {
    const schedule = buildSchedule(DEFAULT_SETTINGS)
    const session = {
      idx: 2,
      remaining: 20,
      round: 2,
      timestamp: Date.now() - 120000, // 2 minutes ago
      settings: DEFAULT_SETTINGS,
      scheduleLength: schedule.length,
    }

    saveSession(session)

    render(<App />)

    expect(screen.getByText(/2 min ago/i)).toBeTruthy()
  })
})
