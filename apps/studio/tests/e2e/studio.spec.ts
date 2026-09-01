import { expect, test } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const snapshotDirectory = resolve(process.cwd(), '../../docs/ui-snapshots')

const enterEditor = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: /Create sprite/ }).click()
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByTestId('pixel-canvas')).toBeVisible()
  await expect(page.locator('.save-state')).not.toContainText('Restoring', { timeout: 30_000 })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-titlebar')).toBeVisible()
  await expect(page.getByTestId('project-hub')).toBeVisible()
  await expect(page.getByTestId('app-splash')).toBeHidden()
  await expect(page.getByText('Indexing Documents/zakape…', { exact: true })).toBeHidden({
    timeout: 30_000,
  })
})

test('opens as a complete animation workbench', async ({ page }) => {
  await expect(page.getByText('Make small worlds move.')).toBeVisible()
  await expect(page.getByText('Documents/zakape', { exact: true })).toBeVisible()
  await enterEditor(page)
  await expect(page.getByRole('button', { name: /Export/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Assist/ })).toHaveClass(/active/)
  await expect(page.getByText('Untitled sprite', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(1)
})

test('draws, changes tools, and exposes undo state', async ({ page }) => {
  await enterEditor(page)
  const canvas = page.getByTestId('pixel-canvas')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  await canvas.click({ position: { x: box!.width * 0.2, y: box!.height * 0.2 } })
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()

  await page.getByTestId('tool-eraser').click()
  await expect(page.getByTestId('tool-eraser')).toHaveAttribute('aria-pressed', 'true')
})

test('duplicates an animation frame', async ({ page }) => {
  await enterEditor(page)
  await page.getByRole('button', { name: 'Duplicate frame' }).click()
  await expect(page.getByRole('listitem')).toHaveCount(2)
})

test('returns to project home and reopens a saved project', async ({ page }) => {
  await enterEditor(page)
  await page.getByRole('button', { name: 'File', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Projects' }).click()
  await expect(page.getByTestId('project-hub')).toBeVisible()
  await expect(page.getByRole('button', { name: /Untitled sprite/ })).toBeVisible()
  await page.getByRole('button', { name: /Untitled sprite/ }).click()
  await expect(page.getByTestId('pixel-canvas')).toBeVisible()
})

test('exports an animated GIF and portable project', async ({ page }) => {
  await enterEditor(page)
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
  expect(exportedProject.frames).toHaveLength(1)
})

test('discovers installed Ollama models and switches providers', async ({ page }) => {
  await enterEditor(page)
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
  await enterEditor(page)
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

test('asks whether the assistant should edit one frame or the entire sheet', async ({ page }) => {
  await enterEditor(page)
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole('button', { name: 'Duplicate frame' }).click()
  }
  await expect(page.getByRole('listitem')).toHaveCount(4)
  await page.route('http://127.0.0.1:11434/api/tags', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'pixel-director:32b', size: 19_000_000_000 }] }),
    })
  })
  await page.route('http://127.0.0.1:11434/api/chat', async (route) => {
    const body = route.request().postDataJSON() as {
      format: { type: string }
      messages: Array<{ content: string }>
    }
    const artRequest = JSON.parse(body.messages[1]!.content) as {
      edit_scope: string
      target_frame_ids: string[]
    }
    expect(body.format.type).toBe('object')
    expect(artRequest.edit_scope).toBe('full_animation')
    expect(artRequest.target_frame_ids).toHaveLength(4)
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        message: {
          content: JSON.stringify({
            summary: 'Keep one warm highlight attached through the run cycle.',
            frames: artRequest.target_frame_ids.map((frameId, index) => ({
              frame_id: frameId,
              operations: [
                {
                  type: 'set_pixels',
                  pixels: [{ x: 7 + index, y: 7, color: '#fff1bd' }],
                },
              ],
            })),
          }),
        },
      }),
    })
  })

  await expect(page.getByTestId('assistant-scope-frame')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('.connection-row').click()
  await page.getByRole('button', { name: 'Find models' }).click()
  await page.keyboard.press('Escape')

  await page.getByTestId('assistant-scope-sheet').click()
  await expect(page.getByTestId('assistant-scope-sheet')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/Coordinate one edit across all 4 frames/)).toBeVisible()
  await page
    .getByLabel('Assistant prompt')
    .fill('Keep the spark attached while the character runs.')
  await page.getByRole('button', { name: 'Propose' }).click()

  await expect(page.getByText(/4 validated operations across 4 frames/)).toBeVisible()
  await page.screenshot({ path: resolve(snapshotDirectory, 'assistant-entire-sheet-proposal.png') })
  await page.getByRole('button', { name: 'Apply to 4 frames' }).click()
  await expect(page.locator('.save-state')).toContainText('Applied assistant edit to 4 frames')
})

test('matches the reviewed desktop layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'project-home.png') })
  await expect(page).toHaveScreenshot('project-home.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.015,
  })
  await enterEditor(page)
  await page.screenshot({ path: resolve(snapshotDirectory, 'studio-workbench.png') })
  await expect(page).toHaveScreenshot('studio-workbench.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.015,
  })
})
