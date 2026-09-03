import { expect, test } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const snapshotDirectory = resolve(process.cwd(), '../../docs/ui-snapshots')
const walkthroughHandled = new WeakSet<import('@playwright/test').Page>()

const enterEditor = async (
  page: import('@playwright/test').Page,
  spec: {
    name?: string
    width?: number
    height?: number
    colorMode?: 'rgba' | 'grayscale' | 'indexed'
    background?: 'transparent' | 'black' | 'white'
    captureSetup?: boolean
    skipWalkthrough?: boolean
  } = {},
) => {
  const launcher = page.getByTestId('project-launcher')
  if (!(await launcher.isVisible())) {
    await page.getByRole('button', { name: 'New sprite', exact: true }).first().click()
  }
  if (!(await launcher.getByRole('textbox', { name: 'Project name' }).isVisible())) {
    await launcher.getByRole('button', { name: 'New sprite', exact: true }).click()
  }
  await launcher.getByRole('textbox', { name: 'Project name' }).fill(spec.name ?? 'Untitled sprite')
  if (spec.width) await launcher.getByRole('spinbutton', { name: 'Width' }).fill(String(spec.width))
  if (spec.height)
    await launcher.getByRole('spinbutton', { name: 'Height' }).fill(String(spec.height))
  if (spec.colorMode) {
    const label =
      spec.colorMode === 'rgba' ? 'RGBA' : spec.colorMode === 'grayscale' ? 'Greyscale' : 'Indexed'
    await launcher.locator('.launcher-segments').getByText(label, { exact: true }).click()
  }
  if (spec.background) {
    await launcher
      .locator('.background-segments')
      .getByText(spec.background, { exact: true })
      .click()
  }
  if (spec.captureSetup) {
    await mkdir(snapshotDirectory, { recursive: true })
    await page.screenshot({ path: resolve(snapshotDirectory, 'new-canvas-dialog.png') })
  }
  await launcher.getByRole('button', { name: 'Create sprite', exact: true }).click()
  await expect(page.getByTestId('project-launcher')).toBeHidden()
  await expect(page.getByTestId('pixel-canvas')).toBeVisible()
  await expect(page.locator('.save-state')).not.toContainText('Restoring', { timeout: 30_000 })
  if (spec.skipWalkthrough !== false && !walkthroughHandled.has(page)) {
    await expect(page.getByRole('button', { name: 'Skip tour' })).toBeVisible()
    await page.getByRole('button', { name: 'Skip tour' }).click()
    walkthroughHandled.add(page)
  }
}

const openAssistant = async (page: import('@playwright/test').Page) => {
  await page.locator('.assistant-launch').click()
  await expect(page.getByLabel('AI art assistant')).toBeVisible()
  await page.waitForTimeout(220)
}

const openFrameActions = async (page: import('@playwright/test').Page, index = 0) => {
  const frame = page.locator('.frame-item').nth(index)
  await frame.hover()
  await frame.getByRole('button', { name: new RegExp(`Frame ${index + 1} actions`) }).click()
  await expect(page.getByRole('menu', { name: 'Frame actions' })).toBeVisible()
}

const copyFrameRight = async (page: import('@playwright/test').Page, index = 0) => {
  await openFrameActions(page, index)
  await page.getByRole('menuitem', { name: /Copy frame to right/ }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-titlebar')).toBeVisible()
  await expect(page.locator('.home-workspace')).toBeVisible()
  await expect(page.getByTestId('app-splash')).toBeHidden({ timeout: 30_000 })
  await expect(page.getByTestId('project-launcher')).toBeHidden()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByRole('status', { name: 'Indexing your workspace…' })).toBeHidden({
    timeout: 30_000,
  })
})

test('shows local account status and exposes desktop update controls', async ({ page }) => {
  const statusbar = page.getByRole('contentinfo', { name: 'Application status' })
  await expect(statusbar).toBeVisible()
  await expect(statusbar).toContainText('Guest')
  await expect(statusbar).toContainText('Local backup')
  await expect(statusbar).toContainText(/v\d+\.\d+\.\d+/)
  expect(await page.evaluate(() => document.fonts.check('16px "Handjet Variable"'))).toBe(true)

  await page.getByRole('button', { name: 'Help' }).click()
  await page.getByRole('menuitem', { name: 'Check for updates' }).click()
  const updateDialog = page.getByRole('dialog', { name: 'Desktop updates' })
  await expect(updateDialog).toContainText(
    'Automatic updates are available in the installed desktop app.',
  )
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'desktop-updater.png') })
  await updateDialog.getByRole('button', { name: 'Close', exact: true }).click()

  await page.getByRole('button', { name: 'Help' }).click()
  await page.getByRole('menuitem', { name: 'About Zakape' }).click()
  await expect(page.getByRole('dialog', { name: 'Zakape' })).toContainText('surelle-ha')
})

test('keeps an indismissable Home tab with recent work and release notes', async ({ page }) => {
  const homeTab = page.getByRole('tab', { name: 'Home', exact: true })
  await expect(homeTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Recent work' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Changelog' })).toBeVisible()
  await expect(page.getByLabel('Workspace details')).toContainText('Documents/zakape')

  await page.getByRole('button', { name: 'New sprite', exact: true }).click()
  await enterEditor(page, { name: 'Home tab study' })
  const canvas = page.getByTestId('pixel-canvas')
  const canvasBox = await canvas.boundingBox()
  await canvas.click({ position: { x: canvasBox!.width / 2, y: canvasBox!.height / 2 } })
  await page.waitForTimeout(900)
  await homeTab.click()
  await expect(page.getByLabel('Home workspace')).toBeVisible()
  await expect(page.locator('.home-document-tab .document-close')).toHaveCount(0)
  await expect(homeTab).toHaveAttribute('aria-selected', 'true')
  const recentCard = page.locator('.home-recent-item').filter({ hasText: 'Home tab study' })
  await expect(recentCard).toBeVisible()
  expect(
    await recentCard.locator('canvas').evaluate((element: HTMLCanvasElement) => {
      const pixels = element
        .getContext('2d')!
        .getImageData(0, 0, element.width, element.height).data
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset] === 217 && pixels[offset + 1] === 70 && pixels[offset + 2] === 239) {
          return true
        }
      }
      return false
    }),
  ).toBe(true)
  await page.mouse.move(700, 700)
  await page.waitForTimeout(180)
  await page.screenshot({ path: resolve(snapshotDirectory, 'workspace-home-tab.png') })

  await page.getByRole('tab', { name: 'Home tab study' }).click()
  await expect(page.getByTestId('pixel-canvas')).toBeVisible()
})

test('creates a named custom-size sprite from the modal launcher', async ({ page }) => {
  await page.getByRole('button', { name: 'New sprite', exact: true }).first().click()
  const launcher = page.getByTestId('project-launcher')
  await launcher.getByRole('button', { name: 'Recent projects' }).click()
  await expect(launcher.getByText('Continue your work')).toBeVisible()
  await expect(launcher.getByText('Documents/zakape', { exact: true })).toBeVisible()
  await launcher.getByRole('button', { name: 'New sprite', exact: true }).click()
  await expect(page.getByRole('radiogroup', { name: 'Canvas presets' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Recent projects' }).click()
  await enterEditor(page, {
    name: 'Moonlit courier',
    width: 48,
    height: 24,
    colorMode: 'grayscale',
    background: 'white',
    captureSetup: true,
  })

  await expect(page.getByRole('tab', { name: 'Moonlit courier' })).toBeVisible()
  await expect(page.getByText('48×24', { exact: true })).toBeVisible()
  await expect(page.locator('.canvas-status')).toContainText('GRAYSCALE')
  await expect(page.locator('.frame-item')).toHaveCount(1)
  await expect(page.getByLabel('Onion skin')).toBeChecked()
  expect((await page.locator('.timeline').boundingBox())!.height).toBeLessThanOrEqual(146)
})

test('creates a sprite with a preset or custom project palette', async ({ page }) => {
  await page.getByRole('button', { name: 'New sprite', exact: true }).first().click()
  const launcher = page.getByTestId('project-launcher')
  await expect(launcher.getByRole('radiogroup', { name: 'Starting palette' })).toBeVisible()
  await launcher.getByRole('radio', { name: /Sweetie 16/ }).click()
  await expect(launcher.getByRole('radio', { name: /Sweetie 16/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await launcher.getByRole('radio', { name: /Custom/ }).click()
  await launcher.getByLabel('Custom palette drawing color').click()
  const picker = page.getByRole('dialog', { name: 'Custom palette color picker' })
  await picker.getByRole('textbox', { name: 'Hex color' }).fill('#22AAFF')
  await picker.getByRole('textbox', { name: 'Hex color' }).press('Enter')
  await picker.getByRole('button', { name: 'Close color picker' }).click()
  await launcher.getByRole('button', { name: 'Add color' }).click()
  await enterEditor(page, { name: 'Palette study' })
  await expect(page.getByRole('list', { name: 'Project color palette' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use #22AAFF as primary color' })).toBeVisible()
})

test('introduces the editor on the first project and keeps help available later', async ({
  page,
}) => {
  await enterEditor(page, { name: 'First sprite', skipWalkthrough: false })
  const tour = page.getByRole('dialog', { name: 'Your tools stay close to the canvas' })
  await expect(tour).toBeVisible()
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'first-project-walkthrough.png') })
  await tour.getByRole('button', { name: 'Next' }).click()
  await expect(
    page.getByRole('heading', { name: 'Layers are independent pixel stacks' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Skip tour' }).click()

  await page.getByRole('button', { name: 'Help' }).click()
  await page.getByRole('menuitem', { name: 'Keyboard shortcuts ?' }).click()
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
  await page.screenshot({ path: resolve(snapshotDirectory, 'shortcut-guide.png') })
})

test('keeps new layers transparent and independent, then renames the selected layer', async ({
  page,
}) => {
  await enterEditor(page, { name: 'Layer study' })
  await page.getByRole('button', { name: 'Toggle layers panel' }).click()
  await expect(page.getByLabel('Layers inspector')).toBeVisible()
  const canvas = page.getByTestId('pixel-canvas')
  const canvasBox = await canvas.boundingBox()
  await canvas.click({ position: { x: canvasBox!.width / 2, y: canvasBox!.height / 2 } })

  const layerRows = page.locator('.layer-row')
  const alphaTotal = async (index: number) =>
    layerRows
      .nth(index)
      .locator('canvas')
      .evaluate((element: HTMLCanvasElement) => {
        const pixels = element
          .getContext('2d')!
          .getImageData(0, 0, element.width, element.height).data
        let total = 0
        for (let offset = 3; offset < pixels.length; offset += 4) total += pixels[offset]!
        return total
      })

  expect(await alphaTotal(0)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Add fresh layer' }).click()
  await expect(layerRows).toHaveCount(2)
  expect(await alphaTotal(0)).toBe(0)
  expect(await alphaTotal(1)).toBeGreaterThan(0)

  await canvas.click({ position: { x: canvasBox!.width / 2 + 16, y: canvasBox!.height / 2 } })
  expect(await alphaTotal(0)).toBeGreaterThan(0)
  await page.keyboard.press('F2')
  await page.getByRole('textbox', { name: 'Layer name' }).fill('Highlights')
  await page.getByRole('textbox', { name: 'Layer name' }).press('Enter')
  await expect(layerRows.nth(0).getByText('Highlights', { exact: true })).toBeVisible()

  await layerRows.nth(1).getByRole('button', { name: /Hide/ }).click()
  expect(await alphaTotal(0)).toBeGreaterThan(0)
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'independent-layers.png') })
})

test('shows accessible custom tooltips and editor command shortcuts', async ({ page }) => {
  await enterEditor(page)
  await page.getByTestId('tool-line').focus()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('Line')
  await expect(tooltip).toContainText('L')
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'custom-tool-tooltip.png') })

  await page.keyboard.press('m')
  await expect(page.getByTestId('tool-mirror')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Control+Shift+n')
  await expect(page.locator('.layer-row')).toHaveCount(2)
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '?',
        code: 'Slash',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  )
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('a')
  await expect(page.getByLabel('AI art assistant')).toBeVisible()
})

test('keeps multiple sprite documents open as switchable tabs', async ({ page }) => {
  await enterEditor(page, { name: 'Idle cycle' })
  await page.getByRole('button', { name: 'Create another sprite' }).click()
  await enterEditor(page, { name: 'Run cycle', width: 64, height: 32 })

  await expect(page.locator('.document-tab [role="tab"]')).toHaveCount(2)
  await page.getByRole('tab', { name: 'Idle cycle' }).click()
  await expect(page.locator('.project-name')).toHaveText('Idle cycle')
  await page.getByRole('tab', { name: 'Run cycle' }).click({ button: 'right' })
  await expect(page.getByRole('menu', { name: 'Document actions' })).toBeVisible()
  await page.getByRole('menuitem', { name: /Close document/ }).click()
  await expect(page.getByRole('dialog', { name: 'Close “Run cycle”?' })).toBeVisible()
  await page.getByRole('button', { name: 'Close project' }).click()
  await expect(page.locator('.document-tab [role="tab"]')).toHaveCount(1)
})

test('confirms project and application close requests before leaving work', async ({ page }) => {
  await enterEditor(page, { name: 'Confirmation study' })

  await page.getByRole('button', { name: 'Close window' }).click()
  const applicationDialog = page.getByRole('dialog', { name: 'Exit Zakape?' })
  await expect(applicationDialog).toBeVisible()
  await expect(applicationDialog).toContainText('1 open project will be saved')
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'exit-confirmation.png') })
  await applicationDialog.getByRole('button', { name: 'Keep working' }).click()
  await expect(applicationDialog).toBeHidden()

  await page.getByRole('button', { name: 'Close Confirmation study' }).click()
  const projectDialog = page.getByRole('dialog', { name: 'Close “Confirmation study”?' })
  await expect(projectDialog).toBeVisible()
  await projectDialog.getByRole('button', { name: 'Keep open' }).click()
  await expect(page.getByRole('tab', { name: 'Confirmation study' })).toBeVisible()

  await page.getByRole('button', { name: 'Close Confirmation study' }).click()
  await page.getByRole('button', { name: 'Close project' }).click()
  await expect(page.getByLabel('Home workspace')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Confirmation study' })).toHaveCount(0)
})

test('shows shape previews before committing and keeps undo meaningful', async ({ page }) => {
  await enterEditor(page)
  await page.getByTestId('tool-line').click()
  const canvas = page.getByTestId('pixel-canvas')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const before = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())

  await page.mouse.move(box!.x + box!.width * 0.2, box!.y + box!.height * 0.25)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.72, box!.y + box!.height * 0.62, { steps: 4 })
  const preview = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
  expect(preview).not.toBe(before)
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'line-tool-preview.png') })

  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.getByTestId('tool-rectangle').click()
  const rectangleBase = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
  await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height * 0.25)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.65, box!.y + box!.height * 0.6)
  expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(
    rectangleBase,
  )
  await page.mouse.up()
})

test('paints with mouse-selected colors, mirror axes, and dithering', async ({ page }) => {
  await enterEditor(page)
  const canvas = page.getByTestId('pixel-canvas')
  const zoom = Number(await page.getByLabel('Canvas zoom').inputValue())
  const clickPixel = async (x: number, y: number, button: 'left' | 'right' = 'left') => {
    await canvas.click({
      button,
      position: { x: (x + 0.5) * zoom, y: (y + 0.5) * zoom },
    })
  }
  const readPixel = (x: number, y: number) =>
    canvas.evaluate(
      (element: HTMLCanvasElement, point) =>
        Array.from(
          element
            .getContext('2d')!
            .getImageData(point.x * point.zoom + 2, point.y * point.zoom + 2, 1, 1).data,
        ),
      { x, y, zoom },
    )

  const secondary = page.getByLabel('Secondary drawing color')
  await secondary.click()
  const secondaryPicker = page.getByRole('dialog', { name: 'Secondary color picker' })
  await secondaryPicker.getByRole('textbox', { name: 'Hex color' }).fill('#00ff00')
  await secondaryPicker.getByRole('textbox', { name: 'Hex color' }).press('Enter')
  await expect(secondaryPicker).toContainText('#00FF00')
  await secondaryPicker.getByRole('button', { name: 'Close color picker' }).click()
  await expect(secondary).toHaveClass(/active/)

  const primary = page.getByLabel('Primary drawing color')
  await primary.click()
  const primaryPicker = page.getByRole('dialog', { name: 'Primary color picker' })
  await primaryPicker.getByRole('textbox', { name: 'Hex color' }).fill('#ff0000')
  await primaryPicker.getByRole('textbox', { name: 'Hex color' }).press('Enter')
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'custom-color-picker.png') })
  await primaryPicker.getByRole('button', { name: 'Close color picker' }).click()
  await page.getByTestId('tool-pencil').click()
  await clickPixel(3, 4)
  await clickPixel(4, 4, 'right')
  expect((await readPixel(3, 4)).slice(0, 3)).toEqual([255, 0, 0])
  expect((await readPixel(4, 4)).slice(0, 3)).toEqual([0, 255, 0])

  await page.getByTestId('tool-mirror').click()
  await clickPixel(5, 7)
  expect((await readPixel(5, 7)).slice(0, 3)).toEqual([255, 0, 0])
  expect((await readPixel(26, 7)).slice(0, 3)).toEqual([255, 0, 0])

  await page.keyboard.down('Control')
  await clickPixel(8, 6)
  await page.keyboard.up('Control')
  expect((await readPixel(8, 25)).slice(0, 3)).toEqual([255, 0, 0])

  await page.keyboard.down('Shift')
  await clickPixel(10, 9)
  await page.keyboard.up('Shift')
  expect((await readPixel(21, 22)).slice(0, 3)).toEqual([255, 0, 0])

  await page.getByTestId('tool-dither').click()
  await expect(page.locator('.brush-control .brush-dot')).toHaveCount(4)
  await expect(page.getByRole('button', { name: '1 pixel brush' })).toHaveText('')
  await page.getByRole('button', { name: '4 pixel brush' }).click()
  await clickPixel(15, 15)
  expect((await readPixel(14, 14)).slice(0, 3)).toEqual([255, 0, 0])
  expect((await readPixel(15, 14)).slice(0, 3)).toEqual([0, 255, 0])
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'mirror-dither-tools.png') })
})

test('selects rectangular and lasso regions and moves selected pixels', async ({ page }) => {
  await enterEditor(page)
  const canvas = page.getByTestId('pixel-canvas')
  const zoom = Number(await page.getByLabel('Canvas zoom').inputValue())
  const point = (x: number, y: number) => ({ x: (x + 0.5) * zoom, y: (y + 0.5) * zoom })

  await canvas.click({ position: point(3, 3) })
  await canvas.click({ position: point(4, 3) })
  await page.getByTestId('tool-select-rect').click()
  await canvas.hover({ position: point(2, 2) })
  await page.mouse.down()
  await canvas.hover({ position: point(5, 5) })
  await page.mouse.up()

  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'box-selection.png') })
  await canvas.hover({ position: point(3, 3) })
  await page.mouse.down()
  await canvas.hover({ position: point(8, 7) })
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()

  await page.keyboard.press('q')
  await expect(page.getByTestId('tool-select-lasso')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
})

test('owns frame creation, copying, deletion, and onion skin in each frame menu', async ({
  page,
}) => {
  await enterEditor(page)
  const canvas = page.getByTestId('pixel-canvas')
  const box = await canvas.boundingBox()
  await canvas.click({ position: { x: box!.width * 0.35, y: box!.height * 0.35 } })

  await openFrameActions(page)
  await page.getByRole('menuitem', { name: /Blank frame to right/ }).click()
  await expect(page.locator('.frame-item')).toHaveCount(2)
  const withSilhouette = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
  await openFrameActions(page, 1)
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'frame-actions-onion-skin.png') })
  await page.keyboard.press('Escape')
  await page.getByLabel('Onion skin').uncheck()
  const withoutSilhouette = await canvas.evaluate((element: HTMLCanvasElement) =>
    element.toDataURL(),
  )
  expect(withSilhouette).not.toBe(withoutSilhouette)

  await copyFrameRight(page, 1)
  await expect(page.locator('.frame-item')).toHaveCount(3)
  await page.locator('.frame-item').nth(1).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete frame' }).click()
  await expect(page.locator('.frame-item')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /Add frame|Duplicate frame/ })).toHaveCount(0)
})

test('rearranges frame playback order with drag and undo', async ({ page }) => {
  await enterEditor(page, { name: 'Frame order study' })
  await openFrameActions(page)
  await page.getByRole('menuitem', { name: /Blank frame to right/ }).click()
  await openFrameActions(page, 1)
  await page.getByRole('menuitem', { name: /Blank frame to right/ }).click()

  const frames = page.locator('.frame-item')
  const originalOrder = await frames.evaluateAll((items) =>
    items.map((item) => item.getAttribute('data-frame-id')),
  )
  await expect(page.getByRole('button', { name: 'Arrange' })).toHaveCount(0)
  await frames
    .nth(0)
    .locator('.frame-cell')
    .dragTo(frames.nth(2).locator('.frame-cell'), { targetPosition: { x: 60, y: 35 } })
  await expect
    .poll(() =>
      frames.evaluateAll((items) => items.map((item) => item.getAttribute('data-frame-id'))),
    )
    .toEqual([originalOrder[1], originalOrder[2], originalOrder[0]])
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'rearrange-frames.png') })

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect
    .poll(() =>
      frames.evaluateAll((items) => items.map((item) => item.getAttribute('data-frame-id'))),
    )
    .toEqual(originalOrder)

  await page.keyboard.press('Control+ArrowLeft')
  await expect
    .poll(() =>
      frames.evaluateAll((items) => items.map((item) => item.getAttribute('data-frame-id'))),
    )
    .toEqual([originalOrder[0], originalOrder[2], originalOrder[1]])
})

test('zooms with Ctrl wheel, scales the work grid, and pans with the hand tool', async ({
  page,
}) => {
  await enterEditor(page, { width: 64, height: 64 })
  const zoomInput = page.getByLabel('Canvas zoom')
  const scrollHost = page.locator('.canvas-scroll')
  const gridToggle = page.getByRole('button', { name: 'Toggle pixel grid' })
  const transparencyToggle = page.getByRole('button', {
    name: 'Toggle transparency checkerboard',
  })
  await expect(gridToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(transparencyToggle).toHaveAttribute('aria-pressed', 'true')
  await transparencyToggle.click()
  await expect(transparencyToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(scrollHost).toHaveCSS('background-size', '14px 14px, 14px 14px')
  await scrollHost.hover()
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -120)
  await page.keyboard.up('Control')
  await expect(zoomInput).toHaveValue('15')
  await expect(scrollHost).toHaveCSS('background-size', '15px 15px, 15px 15px')

  await zoomInput.fill('24')
  await page.getByTestId('tool-hand').click()
  await scrollHost.evaluate((element) => {
    element.scrollLeft = 260
    element.scrollTop = 260
  })
  const before = await scrollHost.evaluate((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop,
  }))
  const hostBox = await scrollHost.boundingBox()
  await page.mouse.move(hostBox!.x + hostBox!.width / 2, hostBox!.y + hostBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(hostBox!.x + hostBox!.width / 2 - 90, hostBox!.y + hostBox!.height / 2 - 70)
  await page.mouse.up()
  const after = await scrollHost.evaluate((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop,
  }))
  expect(after.left).toBeGreaterThan(before.left)
  expect(after.top).toBeGreaterThan(before.top)
  await expect(scrollHost).toHaveClass(/is-scrolling/)
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'canvas-pan-scrollbars.png') })
})

test('uses secondary-color right-click painting without leaking browser menus', async ({
  page,
}) => {
  await enterEditor(page)
  const canvas = page.getByTestId('pixel-canvas')
  await canvas.click({ button: 'right' })
  await expect(page.locator('.panel-context-menu')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()

  await page.locator('.frame-item').click({ button: 'right' })
  await expect(page.getByRole('menu', { name: 'Frame actions' })).toBeVisible()
  await page.keyboard.press('Escape')
  await canvas.focus()
  await page.keyboard.press('Control+A')
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('')
  expect(
    await page.evaluate(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'r',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }),
  ).toBe(true)
})

test('exports an animated GIF and portable project', async ({ page }) => {
  await enterEditor(page)
  await page.getByRole('button', { name: /Export/ }).click()
  const [gifDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Animated GIF/ }).click(),
  ])
  const gifPath = await gifDownload.path()
  expect(gifDownload.suggestedFilename()).toMatch(/\.gif$/)
  expect((await readFile(gifPath!)).subarray(0, 6).toString('ascii')).toBe('GIF89a')

  await page.getByRole('button', { name: /Export/ }).click()
  const [projectDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Zakape project/ }).click(),
  ])
  const projectPath = await projectDownload.path()
  const exportedProject = JSON.parse(await readFile(projectPath!, 'utf8')) as {
    version: number
    frames: unknown[]
  }
  expect(projectDownload.suggestedFilename()).toMatch(/\.zakape$/)
  expect(exportedProject.version).toBe(1)
  expect(exportedProject.frames).toHaveLength(1)
})

test('discovers installed Ollama models and switches providers', async ({ page }) => {
  await enterEditor(page)
  await openAssistant(page)
  await expect(page.locator('.suggestion-list')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add a warm rim light' })).toHaveCount(0)
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'assistant-drawer.png') })
  await page.route('http://127.0.0.1:11434/api/tags', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'qwen2.5-coder:7b', size: 4_700_000_000 }] }),
    })
  })

  await page.getByRole('button', { name: /Manage model/ }).click()
  await expect(page.getByRole('dialog', { name: 'Choose where the model runs' })).toBeVisible()
  await page.getByRole('button', { name: 'Find models' }).click()
  await expect(page.getByLabel('Installed model')).toHaveValue('qwen2.5-coder:7b')
  await expect(page.getByText('Ollama is ready')).toBeVisible()
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'ollama-connection-ready.png') })

  await page.getByRole('button', { name: /Compatible API/ }).click()
  await expect(page.getByLabel(/API key/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /Manage model/ })).toBeFocused()
})

test('explains how to recover when local Ollama is offline', async ({ page }) => {
  await enterEditor(page)
  await openAssistant(page)
  await page.route('http://127.0.0.1:11434/api/tags', async (route) => {
    await route.abort('connectionrefused')
  })
  await page.getByRole('button', { name: /Manage model/ }).click()
  await page.getByRole('button', { name: 'Find models' }).click()
  await expect(page.getByRole('alert')).toContainText('Ollama is not running')
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'ollama-connection-offline.png') })
})

test('asks whether the assistant should edit one frame or the entire sheet', async ({ page }) => {
  await enterEditor(page)
  await openAssistant(page)
  for (let index = 0; index < 3; index += 1) await copyFrameRight(page, index)
  await expect(page.locator('.frame-item')).toHaveCount(4)
  await page.route('http://127.0.0.1:11434/api/tags', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'pixel-director:32b', size: 19_000_000_000 }] }),
    })
  })
  let assistantPass = 0
  await page.route('http://127.0.0.1:11434/api/chat', async (route) => {
    assistantPass += 1
    const body = route.request().postDataJSON() as {
      format: { type: string }
      messages: Array<{ content: string }>
    }
    const artRequest = JSON.parse(body.messages[1]!.content) as {
      edit_scope: string
      target_frame_ids: string[]
      active_layer: { id: string }
      agent_pass: { number: number; phase: string }
    }
    expect(body.format.type).toBe('object')
    expect(artRequest.edit_scope).toBe('full_animation')
    expect(artRequest.target_frame_ids).toHaveLength(4)
    expect(artRequest.agent_pass.number).toBe(assistantPass)
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        message: {
          content: JSON.stringify({
            summary:
              assistantPass === 1
                ? 'Keep one warm highlight attached through the run cycle.'
                : 'Reviewed the highlight spacing and animation continuity.',
            actions: [],
            edits:
              assistantPass === 1
                ? artRequest.target_frame_ids.map((frameId, index) => ({
                    layer_id: artRequest.active_layer.id,
                    frame_id: frameId,
                    operations: [
                      { type: 'set_pixels', pixels: [{ x: 7 + index, y: 7, color: '#fff1bd' }] },
                    ],
                  }))
                : [],
            review_notes: [
              assistantPass === 1
                ? 'The warm accent follows the moving form.'
                : 'Native-size review found consistent spacing and no isolated noise.',
            ],
            ready: assistantPass >= 2,
          }),
        },
      }),
    })
  })

  await page.getByRole('button', { name: /Manage model/ }).click()
  await page.getByRole('button', { name: 'Find models' }).click()
  await page.keyboard.press('Escape')
  await page.getByTestId('assistant-scope-sheet').click()
  await expect(page.getByTestId('assistant-scope-sheet')).toHaveAttribute('aria-pressed', 'true')
  await page
    .getByLabel('Assistant message')
    .fill('Keep the spark attached while the character runs.')
  await page.getByRole('button', { name: 'Send message' }).click()

  await expect(page.getByText(/Ready after 2 passes/)).toBeVisible()
  await expect(page.getByText(/4 operations across 4 edited frames/)).toBeVisible()
  expect(assistantPass).toBe(2)
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'assistant-entire-sheet-proposal.png') })
  await page.getByRole('button', { name: 'Apply work' }).click()
  await expect(page.getByText(/Ready after 2 passes/)).toBeHidden()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()

  await page.waitForTimeout(1000)
  await page.reload()
  await expect(page.getByTestId('app-splash')).toBeHidden({ timeout: 30_000 })
  await expect(page.getByTestId('project-launcher')).toBeHidden()
  await page.locator('.home-recent-item').filter({ hasText: 'Untitled sprite' }).click()
  await openAssistant(page)
  await expect(page.getByText('Keep the spark attached while the character runs.')).toBeVisible()
  await expect(
    page.getByText('Reviewed the highlight spacing and animation continuity.'),
  ).toBeVisible()
})

test('keeps the complete toolset compact at the minimum desktop size', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 })
  await expect(page.getByLabel('Home workspace')).toBeVisible()
  await page.getByRole('button', { name: 'New sprite', exact: true }).first().click()
  const launcherBounds = await page.getByTestId('project-launcher').locator('section').boundingBox()
  expect(launcherBounds!.width).toBeLessThan(1024)
  expect(launcherBounds!.height).toBeLessThan(684)

  await enterEditor(page)
  const timelineBounds = await page.locator('.timeline').boundingBox()
  const handBounds = await page.getByTestId('tool-hand').boundingBox()
  expect(timelineBounds!.height).toBeLessThanOrEqual(130)
  expect(handBounds!.y + handBounds!.height).toBeLessThan(timelineBounds!.y)
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'compact-minimum-workbench.png') })
})

test('matches the reviewed desktop layouts', async ({ page }) => {
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'project-home.png') })
  await expect(page).toHaveScreenshot('project-home.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.015,
  })
  await page.getByRole('button', { name: 'New sprite', exact: true }).first().click()
  await page.screenshot({ path: resolve(snapshotDirectory, 'project-launcher.png') })
  await expect(page).toHaveScreenshot('project-launcher.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.015,
  })
  await enterEditor(page, { name: 'Night courier' })
  await page.screenshot({ path: resolve(snapshotDirectory, 'studio-workbench.png') })
  await expect(page).toHaveScreenshot('studio-workbench.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.015,
  })
})
