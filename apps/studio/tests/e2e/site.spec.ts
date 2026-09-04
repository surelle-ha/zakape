import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const snapshotDirectory = resolve(process.cwd(), '../../docs/ui-snapshots')

test('public site explains the workbench and optional assistant', async ({ page }) => {
  await page.goto('http://127.0.0.1:3301')
  await expect(page.getByRole('heading', { name: /Draw every pixel/i })).toBeVisible()
  await expect(page.getByText('A real editor first.')).toBeVisible()
  await expect(page.getByText('Your model.')).toBeVisible()
  await expect(page.getByRole('link', { name: /View source/i })).toHaveAttribute(
    'href',
    'https://github.com/surelle-ha/zakape',
  )
})

test('matches the reviewed website layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
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
  await page.goto('http://127.0.0.1:3301')
  await expect(page.getByRole('heading', { name: /Draw every pixel/i })).toBeVisible()
  await expect(page.getByAltText(/Zakape Studio showing a selected group/i)).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeHidden()
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
