import { PassThrough } from 'stream'

import { renderSync } from '@hermes/ink'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

// Stub useInput so the overlay doesn't try to enter raw mode under renderSync
// (PassThrough stdin doesn't support it). Box/Text pass through to real Ink.
vi.mock('@hermes/ink', async importOriginal => {
  const mod = await importOriginal()

  return {
    ...mod,
    useInput: () => {}
  }
})

import type { SubscriptionOverlayState } from '../app/interfaces.js'
import { SubscriptionOverlay } from '../components/subscriptionOverlay.js'
import type { SubscriptionStateResponse, SubscriptionTierOption } from '../gatewayTypes.js'
import { stripAnsi } from '../lib/text.js'
import { DEFAULT_THEME } from '../theme.js'

const t = DEFAULT_THEME

/** Render a SubscriptionOverlay to a string via renderSync + PassThrough. */
function render(overlay: SubscriptionOverlayState): string {
  const stdout = new PassThrough()
  const stdin = new PassThrough()
  const stderr = new PassThrough()

  let output = ''

  Object.assign(stdout, { columns: 100, isTTY: false, rows: 40 })
  Object.assign(stdin, { isTTY: false })
  Object.assign(stderr, { isTTY: false })
  stdout.on('data', chunk => {
    output += chunk.toString()
  })

  const instance = renderSync(
    React.createElement(SubscriptionOverlay, {
      onClose: () => {},
      onPatch: () => {},
      overlay,
      t
    }),
    {
      patchConsole: false,
      stderr: stderr as NodeJS.WriteStream,
      stdin: stdin as NodeJS.ReadStream,
      stdout: stdout as NodeJS.WriteStream
    }
  )

  instance.unmount()
  instance.cleanup()

  return stripAnsi(output)
}

const tier = (overrides: Partial<SubscriptionTierOption> = {}): SubscriptionTierOption => ({
  tier_id: 'free',
  name: 'Free',
  tier_order: 0,
  dollars_per_month_display: '$0',
  monthly_credits: '0',
  is_current: false,
  is_enabled: true,
  ...overrides
})

const state = (overrides: Partial<SubscriptionStateResponse> = {}): SubscriptionStateResponse => ({
  ok: true,
  logged_in: true,
  is_admin: true,
  can_change_plan: true,
  org_name: 'Acme',
  org_id: 'org_acme',
  role: 'OWNER',
  current: null,
  tiers: [],
  portal_url: 'https://portal.nousresearch.com/billing',
  ...overrides
})

const ctx = {
  openManageLink: vi.fn(() => Promise.resolve(true)),
  refreshState: vi.fn(() => Promise.resolve(null)),
  sys: vi.fn()
}

const overlay = (s: SubscriptionStateResponse, screen: SubscriptionOverlayState['screen'] = 'overview'): SubscriptionOverlayState => ({
  ctx,
  screen,
  state: s,
  pendingTargetTierId: null
})

describe('SubscriptionOverlay — overview screen', () => {
  it('(a) free: shows free upsell + manage, no tier list, no "credits"', () => {
    const s = state({
      current: null,
      usage: { available: true, status: 'free', plan_name: null },
      tiers: [
        tier({ tier_id: 'free', name: 'Free', tier_order: 0, dollars_per_month_display: '$0', monthly_credits: '0' }),
        tier({ tier_id: 'pro', name: 'Pro', tier_order: 1, dollars_per_month_display: '$20', monthly_credits: '1000', is_current: false }),
        tier({ tier_id: 'scale', name: 'Scale', tier_order: 2, dollars_per_month_display: '$99', monthly_credits: '5000', is_current: false })
      ]
    })

    const out = render(overlay(s))

    expect(out).toContain('Plan: Free · free models only')
    expect(out).toContain('Paid models need a subscription')
    expect(out).toContain('Start a subscription')
    // No selectable tier menu — tiers are not listed in-terminal anymore.
    expect(out).not.toContain('$20/mo')
    expect(out.toLowerCase()).not.toContain('credits')
  })

  it('(b) subscriber mid-tier: status line + dollar plan bar', () => {
    const s = state({
      current: {
        tier_id: 'pro',
        tier_name: 'Pro',
        monthly_credits: '1000',
        credits_remaining: '420',
        cycle_ends_at: '2026-07-01',
        pending_downgrade_tier_name: null,
        pending_downgrade_at: null
      },
      usage: {
        available: true,
        status: 'healthy',
        plan_name: 'Pro',
        renews_at: '2026-07-01',
        total_spendable_display: '$14.00',
        plan_bar: {
          kind: 'plan',
          remaining_display: '$14.00',
          total_display: '$20.00',
          spent_display: '$6.00',
          pct_used: 30,
          fill_fraction: 0.7
        }
      },
      tiers: [
        tier({ tier_id: 'free', name: 'Free', tier_order: 0 }),
        tier({ tier_id: 'pro', name: 'Pro', tier_order: 1, dollars_per_month_display: '$20', monthly_credits: '1000', is_current: true }),
        tier({ tier_id: 'scale', name: 'Scale', tier_order: 2, dollars_per_month_display: '$99', monthly_credits: '5000' })
      ]
    })

    const out = render(overlay(s))

    expect(out).toContain('Plan: Pro')
    expect(out).toContain('$14.00 left of $20.00')
    expect(out).toContain('30% used')
    expect(out.toLowerCase()).not.toContain('credits')
  })

  it('(b2) subscriber + top-up: shows both bars', () => {
    const s = state({
      current: {
        tier_id: 'pro',
        tier_name: 'Pro',
        monthly_credits: '1000',
        credits_remaining: '700',
        cycle_ends_at: '2026-07-01',
        pending_downgrade_tier_name: null,
        pending_downgrade_at: null
      },
      usage: {
        available: true,
        status: 'healthy',
        plan_name: 'Pro',
        renews_at: '2026-07-01',
        total_spendable_display: '$26.00',
        has_topup: true,
        plan_bar: { kind: 'plan', remaining_display: '$14.00', total_display: '$20.00', spent_display: '$6.00', pct_used: 30, fill_fraction: 0.7 },
        topup_bar: { kind: 'topup', remaining_display: '$12.00', total_display: '$12.00', spent_display: '$0.00', pct_used: null, fill_fraction: 1 }
      },
      tiers: [tier({ tier_id: 'pro', name: 'Pro', tier_order: 1, is_current: true })]
    })

    const out = render(overlay(s))

    expect(out).toContain('Pro')
    expect(out).toContain('top-up')
    expect(out).toContain('$12.00')
    expect(out).toContain('never expires')
  })

  it('(b3) low balance: shows alert nudge', () => {
    const s = state({
      current: { tier_id: 'pro', tier_name: 'Pro', monthly_credits: '1000', credits_remaining: '170', cycle_ends_at: '2026-07-01', pending_downgrade_tier_name: null, pending_downgrade_at: null },
      usage: {
        available: true,
        status: 'low',
        plan_name: 'Pro',
        renews_at: '2026-07-01',
        total_spendable_display: '$3.40',
        plan_bar: { kind: 'plan', remaining_display: '$3.40', total_display: '$20.00', spent_display: '$16.60', pct_used: 83, fill_fraction: 0.17 }
      },
      tiers: [tier({ tier_id: 'pro', name: 'Pro', tier_order: 1, is_current: true })]
    })

    const out = render(overlay(s))

    expect(out).toContain('Plan: Pro · $3.40 left')
    expect(out).toContain('Low balance')
  })

  it('(c) subscriber top-tier: shows top plan note', () => {
    const s = state({
      current: {
        tier_id: 'scale',
        tier_name: 'Scale',
        monthly_credits: '5000',
        credits_remaining: '3000',
        cycle_ends_at: '2026-07-01',
        pending_downgrade_tier_name: null,
        pending_downgrade_at: null
      },
      usage: { available: true, status: 'healthy', plan_name: 'Scale', renews_at: '2026-07-01' },
      tiers: [
        tier({ tier_id: 'free', name: 'Free', tier_order: 0 }),
        tier({ tier_id: 'pro', name: 'Pro', tier_order: 1, is_current: false }),
        tier({ tier_id: 'scale', name: 'Scale', tier_order: 2, dollars_per_month_display: '$99', monthly_credits: '5000', is_current: true })
      ]
    })

    const out = render(overlay(s))

    expect(out).toContain('Plan: Scale')
    expect(out).toContain('Manage on portal')
  })

  it('(d) not-admin: shows read-only note + no tier list', () => {
    const s = state({
      is_admin: false,
      can_change_plan: false,
      role: 'MEMBER',
      current: {
        tier_id: 'pro',
        tier_name: 'Pro',
        monthly_credits: '1000',
        credits_remaining: '500',
        cycle_ends_at: '2026-07-01',
        pending_downgrade_tier_name: null,
        pending_downgrade_at: null
      },
      usage: { available: true, status: 'healthy', plan_name: 'Pro', renews_at: '2026-07-01' },
      tiers: [tier({ tier_id: 'pro', name: 'Pro', tier_order: 1, is_current: true })]
    })

    const out = render(overlay(s))

    expect(out).toContain('view only')
    expect(out).toContain('Manage on portal')
  })

  it('(e) downgrade-pending: shows scheduled switch banner', () => {
    const s = state({
      current: {
        tier_id: 'pro',
        tier_name: 'Pro',
        monthly_credits: '1000',
        credits_remaining: '500',
        cycle_ends_at: '2026-07-01',
        pending_downgrade_tier_name: 'Free',
        pending_downgrade_at: '2026-07-15T00:00:00Z'
      },
      usage: { available: true, status: 'healthy', plan_name: 'Pro', renews_at: '2026-07-01' },
      tiers: [
        tier({ tier_id: 'free', name: 'Free', tier_order: 0 }),
        tier({ tier_id: 'pro', name: 'Pro', tier_order: 1, is_current: true })
      ]
    })

    const out = render(overlay(s))

    expect(out).toContain('Scheduled to switch to Free')
    expect(out).toContain('2026-07-15T00:00:00Z')
  })
})

describe('SubscriptionOverlay — confirm screen', () => {
  it('shows tier summary + Stripe disclosure', () => {
    const s = state({
      current: null,
      tiers: [tier({ tier_id: 'pro', name: 'Pro', tier_order: 1, dollars_per_month_display: '$20', monthly_credits: '1000' })]
    })

    const out = render({ ...overlay(s, 'confirm'), pendingTargetTierId: 'pro' })

    expect(out).toContain('Confirm subscription')
    expect(out).toContain('Pro')
    expect(out).toContain('$20')
    expect(out).toContain('securely on your subscription page')
    expect(out).toContain('Continue to your subscription page')
  })
})

describe('SubscriptionOverlay — handoff screen', () => {
  it('shows opening-subscription-page copy', () => {
    const out = render(overlay(state(), 'handoff'))

    expect(out).toContain('Opening your subscription page')
    expect(out).toContain('browser')
    expect(out).toContain('Re-run /subscription')
  })
})
