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

test('discovers installed Ollama models and switches providers', async ({ page }) => {
  await page.route('http://127.0.0.1:11434/api/tags', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'qwen2.5-coder:7b', size: 4_700_000_000 }] }),
    })
  })

  await page.locator('.connection-row').click()
  await expect(page.getByRole('dialog', { name: 'Choose where the model runs' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Ollama Local runtime/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Find models' }).click()
  await expect(page.getByLabel('Installed model')).toHaveValue('qwen2.5-coder:7b')
  await expect(page.getByText('Ollama is ready')).toBeVisible()
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'ollama-connection-ready.png') })

  await page.getByRole('button', { name: /Compatible API/ }).click()
  await expect(page.getByLabel(/API key/)).toBeVisible()
  await expect(page.getByTestId('ollama-runtime')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Choose where the model runs' })).toBeHidden()
  await expect(page.locator('.connection-row')).toBeFocused()
})

test('explains how to recover when local Ollama is offline', async ({ page }) => {
  await page.route('http://127.0.0.1:11434/api/tags', async (route) => {
    await route.abort('connectionrefused')
  })

  await page.locator('.connection-row').click()
  await page.getByRole('button', { name: 'Find models' }).click()
  await expect(page.getByRole('alert')).toContainText('Ollama is not running')
  await expect(page.getByTestId('ollama-runtime')).toContainText('Unavailable')
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'ollama-connection-offline.png') })
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
