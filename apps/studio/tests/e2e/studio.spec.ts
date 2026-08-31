import { expect, test } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const snapshotDirectory = resolve(process.cwd(), '../../docs/ui-snapshots')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByTestId('pixel-canvas')).toBeVisible()
  await expect(page.locator('.save-state')).not.toContainText('Restoring', { timeout: 30_000 })
})

test('opens as a complete animation workbench', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Export/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Assist/ })).toHaveClass(/active/)
  await expect(page.getByText('Mint runner', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(4)
})

test('draws, changes tools, and exposes undo state', async ({ page }) => {
  const canvas = page.getByTestId('pixel-canvas')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  await canvas.click({ position: { x: box!.width * 0.2, y: box!.height * 0.2 } })
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()

  await page.getByTestId('tool-eraser').click()
  await expect(page.getByTestId('tool-eraser')).toHaveAttribute('aria-pressed', 'true')
})

test('duplicates an animation frame', async ({ page }) => {
  await page.getByRole('button', { name: 'Duplicate frame' }).click()
  await expect(page.getByRole('listitem')).toHaveCount(5)
})

test('exports an animated GIF and portable project', async ({ page }) => {
  await page.getByRole('button', { name: /Export/ }).click()
  const [gifDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Animated GIF/ }).click(),
  ])
  expect(gifDownload.suggestedFilename()).toMatch(/\.gif$/)
  const gifPath = await gifDownload.path()
  expect(gifPath).not.toBeNull()
  expect((await readFile(gifPath!)).subarray(0, 6).toString('ascii')).toBe('GIF89a')

  await page.getByRole('button', { name: /Export/ }).click()
  const [projectDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Zakape project/ }).click(),
  ])
  expect(projectDownload.suggestedFilename()).toMatch(/\.zakape$/)
  const projectPath = await projectDownload.path()
  expect(projectPath).not.toBeNull()
  const exportedProject = JSON.parse(await readFile(projectPath!, 'utf8')) as {
    version: number
    frames: unknown[]
  }
  expect(exportedProject.version).toBe(1)
  expect(exportedProject.frames).toHaveLength(4)
})

test('matches the reviewed desktop layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'studio-workbench.png') })
  await expect(page).toHaveScreenshot('studio-workbench.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.015,
  })
})
