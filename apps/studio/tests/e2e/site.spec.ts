import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const snapshotDirectory = resolve(process.cwd(), '../../docs/ui-snapshots')

test('public site presents the atelier and optional assistant', async ({ page }) => {
  await page.goto('http://127.0.0.1:3301')
  await expect(page.getByRole('heading', { name: /Craft sprites/i })).toBeVisible()
  await expect(page.getByText('Every instrument')).toBeAttached()
  await expect(page.getByText('Your hand leads.')).toBeAttached()
  await expect(page.getByRole('link', { name: /View source/i })).toHaveAttribute(
    'href',
    'https://github.com/surelle-ha/zakape',
  )
})

test('matches the reviewed website layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:3301')
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'website-home.png'), fullPage: true })
  // Windows owns the reviewed pixel baseline. Linux font rasterization differs,
  // while the semantic and overflow assertions still run in CI on Linux.
  if (process.platform === 'win32') {
    await expect(page).toHaveScreenshot('website-home-win32.png', {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.015,
    })
  }
})

test('keeps the real product story readable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:3301')
  await expect(page.getByRole('heading', { name: /Craft sprites/i })).toBeVisible()
  await expect(page.getByAltText(/Zakape Studio showing a selected group/i)).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'website-mobile.png'), fullPage: true })
  if (process.platform === 'win32') {
    await expect(page).toHaveScreenshot('website-mobile-win32.png', {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.015,
    })
  }
})

test('keeps every chapter composed on a tablet', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:3301')
  await expect(page.getByRole('heading', { name: /Craft sprites/i })).toBeVisible()
  await expect(page.locator('.craft-panels')).toBeAttached()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'website-tablet.png'), fullPage: true })
})

test('moves through desktop chapters without hijacking phone scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('http://127.0.0.1:3301')
  const chapters = page.getByRole('navigation', { name: 'Page chapters' })
  await expect(chapters).toBeVisible()
  await expect(chapters.getByRole('button', { name: 'Go to Opening' })).toHaveAttribute(
    'aria-current',
    'step',
  )

  await page.mouse.wheel(0, 720)
  await expect(chapters.getByRole('button', { name: 'Go to Atelier' })).toHaveAttribute(
    'aria-current',
    'step',
  )
  await expect
    .poll(() =>
      page
        .locator('#atelier')
        .evaluate((section) => Math.round(section.getBoundingClientRect().top)),
    )
    .toBeLessThanOrEqual(2)

  // Trackpad momentum and repeated wheel events must not skip a chapter.
  await page.mouse.wheel(0, 720)
  await expect(chapters.getByRole('button', { name: 'Go to Atelier' })).toHaveAttribute(
    'aria-current',
    'step',
  )

  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(chapters).toBeHidden()
  await page.mouse.wheel(0, 360)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
})

test('pricing distinguishes the available editor from planned connected services', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3301/pricing')
  await expect(page.getByRole('heading', { name: 'Open Source' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Studio', exact: true })).toBeVisible()
  await expect(page.getByText('$4')).toBeVisible()
  await expect(page.getByText('No checkout yet.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Download Zakape/i })).toHaveAttribute(
    'href',
    '/download',
  )
})
