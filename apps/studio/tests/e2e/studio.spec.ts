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
    checkerSize?: number
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
  if (spec.checkerSize) {
    await launcher
      .getByRole('spinbutton', { name: 'Checker tile size' })
      .fill(String(spec.checkerSize))
  }
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
  await expect(page.getByTestId('app-titlebar')).toContainText('ZAKAPE STUDIO')
  await expect(page.getByTestId('app-splash')).toBeHidden({ timeout: 30_000 })
  const authentication = page.getByRole('main', { name: /Your studio starts on this device/ })
  await expect(authentication).toBeVisible()
  await authentication.getByRole('button', { name: 'Continue as Guest' }).click()
  await expect(page.locator('.home-workspace')).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator('.home-workspace')
        .evaluate((element) => getComputedStyle(element).backgroundImage),
    )
    .not.toContain('linear-gradient')
  await expect(page.getByTestId('project-launcher')).toBeHidden()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByRole('status', { name: 'Indexing your workspace…' })).toBeHidden({
    timeout: 30_000,
  })
})

test('configures appearance, assistant, and toolbox from the Editor menu', async ({ page }) => {
  await page.getByRole('button', { name: 'Editor', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Appearance…' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Assistant Settings…' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Toolbox Editor…' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Undo' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Redo' })).toHaveCount(0)

  await page.getByRole('menuitem', { name: 'Appearance…' }).click()
  const appearance = page.getByRole('dialog', { name: 'Shape the workbench' })
  await appearance.getByRole('button', { name: /Light/ }).click()
  await appearance.getByRole('button', { name: 'Apply' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'Editor', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Assistant Settings…' }).click()
  const assistant = page.getByRole('dialog', { name: 'Assistant Settings' })
  await assistant.getByRole('tab', { name: 'Instructions' }).click()
  await assistant.getByRole('textbox').fill('Prefer clean two-color ramps.')
  await assistant.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Editor', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Assistant Settings…' }).click()
  await assistant.getByRole('tab', { name: 'Instructions' }).click()
  await expect(assistant.getByRole('textbox')).toHaveValue('')
  await assistant.getByRole('button', { name: 'Cancel' }).click()

  await enterEditor(page, { name: 'Custom toolbox' })
  await page.getByRole('button', { name: 'Editor', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Toolbox Editor…' }).click()
  const toolbox = page.getByRole('dialog', { name: 'Toolbox Editor' })
  const fillRow = toolbox.locator('.toolbox-order li').filter({ hasText: 'Fill' })
  await fillRow.getByRole('checkbox').uncheck()
  await toolbox.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByTestId('tool-fill')).toHaveCount(0)
  await page.keyboard.press('f')
  await expect(page.locator('.tool-chip')).toHaveText('Fill')
  await page.keyboard.press('Control+z')
})

test('centralizes canvas display controls in View without changing document dirtiness', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'View', exact: true }).click()
  const homeViews = page.getByRole('menuitemcheckbox')
  await expect(homeViews).toHaveCount(5)
  for (const label of [
    'Onion skin',
    'Live view',
    'Pixel grid',
    'Transparency checkerboard',
    'Tiled Mode',
  ]) {
    await expect(page.getByRole('menuitemcheckbox', { name: new RegExp(label) })).toBeDisabled()
  }

  await enterEditor(page, { name: 'View menu study' })
  const saveState = page.locator('.save-state')
  const initialSaveState = await saveState.textContent()
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox')).toHaveCount(5)
  for (const label of [
    'Onion skin',
    'Live view',
    'Pixel grid',
    'Transparency checkerboard',
    'Tiled Mode',
  ]) {
    await expect(page.getByRole('menuitemcheckbox', { name: new RegExp(label) })).toBeEnabled()
  }
  await expect(
    page.getByRole('button', {
      name: /Toggle (onion skin|live view|pixel grid|transparency checkerboard)/i,
    }),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.keyboard.press('o')
  await page.keyboard.press('v')
  await page.keyboard.press('g')
  await page.keyboard.press('Shift+g')
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: /Onion skin/ })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await expect(page.getByRole('menuitemcheckbox', { name: /Live view/ })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await expect(page.getByRole('menuitemcheckbox', { name: /Pixel grid/ })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await expect(
    page.getByRole('menuitemcheckbox', { name: /Transparency checkerboard/ }),
  ).toHaveAttribute('aria-checked', 'false')
  await expect(saveState).toHaveText(initialSaveState ?? '')
})

test('edits one wrapped source through a configurable tiled canvas', async ({ page }) => {
  await enterEditor(page, { name: 'Seam study', width: 8, height: 8 })
  const canvas = page.getByTestId('pixel-canvas')
  const normal = (await canvas.boundingBox())!

  await page.keyboard.press('Shift+t')
  await expect(canvas).toHaveAttribute('data-tiled-mode', 'true')
  const tiled = (await canvas.boundingBox())!
  expect(tiled.width).toBe(normal.width * 3)
  expect(tiled.height).toBe(normal.height * 3)
  await page.screenshot({ path: resolve(snapshotDirectory, 'tiled-mode-workspace.png') })

  await page.getByRole('button', { name: 'View', exact: true }).click()
  await page.getByRole('menuitem', { name: /Tiled Mode settings/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Tiled Mode' })
  await page.screenshot({ path: resolve(snapshotDirectory, 'tiled-mode-settings.png') })
  await dialog.getByRole('button', { name: '2×2' }).click()
  await dialog.getByRole('button', { name: 'Apply layout' }).click()
  const resized = (await canvas.boundingBox())!
  expect(resized.width).toBe(normal.width * 2)
  expect(resized.height).toBe(normal.height * 2)

  await canvas.click({ position: { x: normal.width + normal.width / 2, y: normal.height / 2 } })
  const repeatedPixels = await canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d')!
    const size = element.width / 2
    const first = context.getImageData(size / 2, size / 2, 1, 1).data
    const second = context.getImageData(size + size / 2, size / 2, 1, 1).data
    return [...first].join(',') === [...second].join(',')
  })
  expect(repeatedPixels).toBe(true)
  await page.keyboard.press('Control+z')
})

test('shows local account status and exposes desktop update controls', async ({ page }) => {
  const statusbar = page.getByRole('contentinfo', { name: 'Application status' })
  await expect(statusbar).toBeVisible()
  await expect(statusbar).toContainText('Guest')
  await expect(statusbar).not.toContainText('Local backup')
  await expect(statusbar).toContainText(/v\d+\.\d+\.\d+/)
  expect(await page.evaluate(() => document.fonts.check('16px "Handjet Variable"'))).toBe(true)

  await statusbar.getByRole('button', { name: /Guest account/ }).click()
  const accountDialog = page.getByRole('dialog', { name: /Account & artwork/ })
  await expect(accountDialog).toBeVisible()
  await expect(accountDialog).toContainText('Guest artist')
  await expect(accountDialog).toContainText('Artwork stats')
  await expect(accountDialog).toContainText('Documents/zakape')
  const syncArtwork = accountDialog.getByRole('button', {
    name: 'Sync artwork to Zakape server, coming soon',
  })
  await expect(syncArtwork).toBeDisabled()
  await expect(syncArtwork).toContainText('Coming soon')
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'profile-artwork-drawer.png') })
  await accountDialog.getByRole('button', { name: 'Close profile drawer' }).click()
  await expect(accountDialog).toBeHidden()

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

test('keeps support and diagnostics actions in Help without changing the workspace', async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          ;(window as Window & { __copiedSystemInfo?: string }).__copiedSystemInfo = text
        },
      },
    })
    window.open = ((...arguments_: [string, string, string]) => {
      ;(window as Window & { __openedSupportUrl?: string }).__openedSupportUrl = arguments_[0]
      return {} as Window
    }) as typeof window.open
  })

  await page.getByRole('button', { name: 'Help' }).click()
  const help = page.getByRole('menu')
  await expect(help.getByRole('menuitem', { name: 'Copy System Info' })).toBeVisible()
  await expect(help.getByRole('menuitem', { name: 'Report a Bug' })).toBeVisible()
  await expect(help.getByRole('menuitem', { name: 'Suggest a Feature' })).toBeVisible()
  await expect(help.getByRole('menuitem', { name: 'Support Zakape Development' })).toBeVisible()
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'help-support-menu.png') })
  await expect(page.getByRole('button', { name: 'Keyboard shortcuts' })).toHaveCount(0)
  await help.getByRole('menuitem', { name: 'Copy System Info' }).click()
  await expect(page.getByRole('status')).toContainText('System information copied')
  await page.screenshot({ path: resolve(snapshotDirectory, 'system-info-notice.png') })
  expect(
    await page.evaluate(
      () => (window as Window & { __copiedSystemInfo?: string }).__copiedSystemInfo,
    ),
  ).toContain('Zakape system information')

  await page.getByRole('button', { name: 'Help' }).click()
  await page.getByRole('menuitem', { name: 'Report a Bug' }).click()
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __openedSupportUrl?: string }).__openedSupportUrl),
    )
    .toBe('https://github.com/surelle-ha/zakape/issues/new?template=bug.yml')
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

test('flattens Home cards into a continuous phone layout', async ({ page }) => {
  await page.getByRole('button', { name: 'New sprite', exact: true }).click()
  await enterEditor(page, { name: 'Phone layout study' })
  await page.getByRole('tab', { name: 'Home', exact: true }).click()

  const hero = page.locator('.home-hero')
  await expect(hero).toBeVisible()
  expect(await hero.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe('1px')

  await page.setViewportSize({ width: 390, height: 844 })

  await expect(page.getByRole('heading', { name: 'Recent work' })).toBeVisible()
  await expect(
    page.locator('.home-recent-item').filter({ hasText: 'Phone layout study' }),
  ).toBeVisible()

  expect(
    await hero.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        borderTopWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
      }
    }),
  ).toEqual({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderTopWidth: '0px',
    boxShadow: 'none',
  })

  expect(
    await page
      .locator('.home-recent-item')
      .filter({ hasText: 'Phone layout study' })
      .evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          backgroundColor: style.backgroundColor,
          borderLeftWidth: style.borderLeftWidth,
          borderRadius: style.borderRadius,
          borderTopWidth: style.borderTopWidth,
        }
      }),
  ).toEqual({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderLeftWidth: '0px',
    borderRadius: '0px',
    borderTopWidth: '0px',
  })

  const workflowStep = page.locator('.home-workflow article').first()
  expect(
    await workflowStep.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        borderLeftWidth: style.borderLeftWidth,
        borderTopWidth: style.borderTopWidth,
      }
    }),
  ).toEqual({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderLeftWidth: '0px',
    borderTopWidth: '0px',
  })

  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({
    path: resolve(snapshotDirectory, 'mobile-home-flat.png'),
    fullPage: true,
  })
})

test('exposes the Godot Bridge with a clear browser capability boundary', async ({ page }) => {
  await page.getByRole('button', { name: 'Godot Bridge', exact: true }).click()
  const bridge = page.getByRole('dialog', { name: 'Godot Bridge' })
  await expect(bridge).toBeVisible()
  await expect(bridge).toContainText('Connect projects from the Zakape desktop app.')
  await expect(bridge).toContainText('browse res://')
  await expect(page.getByTestId('app-shell')).toHaveAttribute('inert', '')

  await page.keyboard.press('Escape')
  await expect(bridge).toBeHidden()
})

test('opens a selected res folder and refreshes it on every Godot Bridge visit', async ({
  page,
}) => {
  await page.evaluate(() => {
    const resourceEntries = [
      {
        path: 'art',
        name: 'art',
        kind: 'folder',
        isDirectory: true,
        size: 0,
        modifiedAt: null,
        importable: false,
      },
      {
        path: 'art/characters',
        name: 'characters',
        kind: 'folder',
        isDirectory: true,
        size: 0,
        modifiedAt: null,
        importable: false,
      },
      {
        path: 'art/characters/hero.png',
        name: 'hero.png',
        kind: 'texture',
        isDirectory: false,
        size: 2_048,
        modifiedAt: 1,
        importable: true,
      },
      {
        path: 'art/characters/player.gd',
        name: 'player.gd',
        kind: 'script',
        isDirectory: false,
        size: 860,
        modifiedAt: 2,
        importable: false,
      },
      {
        path: 'scenes',
        name: 'scenes',
        kind: 'folder',
        isDirectory: true,
        size: 0,
        modifiedAt: null,
        importable: false,
      },
      {
        path: 'scenes/main.tscn',
        name: 'main.tscn',
        kind: 'scene',
        isDirectory: false,
        size: 4_096,
        modifiedAt: 3,
        importable: false,
      },
    ]
    const browserWindow = window as typeof window & { godotListCount?: number }
    browserWindow.godotListCount = 0
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {
        invoke: async (command: string) => {
          if (command === 'godot_integration_available') return true
          if (command === 'plugin:dialog|open') return 'C:\\game\\art\\characters'
          if (command === 'godot_discover_projects') {
            return {
              projects: [
                {
                  rootPath: 'C:\\game',
                  name: 'Pocket Quest',
                  configVersion: 5,
                  godotVersion: '4.6',
                  compatibility: 'godot4',
                },
              ],
              selectedProjectPath: 'C:\\game',
              selectedDirectory: 'art/characters',
            }
          }
          if (command === 'godot_list_resources') {
            browserWindow.godotListCount = (browserWindow.godotListCount ?? 0) + 1
            return { entries: resourceEntries, truncated: false }
          }
          throw new Error(`Unexpected mocked Tauri command: ${command}`)
        },
      },
    })
  })

  await page.getByRole('button', { name: 'Godot Bridge', exact: true }).click()
  const bridge = page.getByRole('dialog', { name: 'Godot Bridge' })
  await bridge.getByRole('button', { name: 'Open project or res:// folder' }).click()

  await expect(bridge).toContainText('Connected Pocket Quest and opened res://art/characters.')
  await expect(bridge.getByText('C:\\game', { exact: true })).toBeVisible()
  await expect(bridge.getByRole('button', { name: 'Select hero.png' })).toBeVisible()
  await expect(bridge.getByRole('button', { name: 'Select player.gd' })).toBeVisible()
  await expect(bridge).toContainText('6items indexed')
  expect((await bridge.locator('.godot-resource-table').boundingBox())!.height).toBeGreaterThan(300)

  await bridge.getByRole('searchbox', { name: 'Search Godot resources' }).fill('main')
  await expect(bridge.getByRole('button', { name: 'Select main.tscn' })).toBeVisible()
  await bridge.getByRole('button', { name: 'Refresh Godot resources' }).click()
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { godotListCount?: number }).godotListCount),
    )
    .toBe(2)
  await expect(bridge).toContainText('Indexed 6 res:// items.')
  await expect(bridge.getByRole('button', { name: 'Select main.tscn' })).toBeVisible()
  await bridge.getByRole('searchbox', { name: 'Search Godot resources' }).fill('')
  await expect(bridge.getByRole('button', { name: 'Select hero.png' })).toBeVisible()

  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'godot-resource-browser.png') })
  await bridge.getByRole('button', { name: 'Close Godot Bridge' }).click()
  await page.getByRole('button', { name: 'Godot Bridge', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { godotListCount?: number }).godotListCount),
    )
    .toBe(3)
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
    checkerSize: 3,
    colorMode: 'grayscale',
    background: 'white',
    captureSetup: true,
  })

  await expect(page.getByRole('tab', { name: 'Moonlit courier' })).toBeVisible()
  await expect(page.getByText('48×24', { exact: true })).toBeVisible()
  await expect(page.locator('.canvas-status')).toContainText('GRAYSCALE')
  await expect(page.locator('.frame-item')).toHaveCount(1)
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: /Onion skin/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
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

test('allows a skipped or empty custom starting palette', async ({ page }) => {
  await page.getByRole('button', { name: 'New sprite', exact: true }).first().click()
  const launcher = page.getByTestId('project-launcher')
  const skip = launcher.getByRole('radio', { name: /Skip/ })
  await expect(skip).toBeVisible()
  await skip.click()
  await expect(launcher.locator('.document-note')).toContainText('no starting colors')
  await launcher.getByRole('radio', { name: /Custom/ }).click()
  await expect(launcher.locator('.custom-palette-colors > span')).toHaveCount(0)
  await expect(launcher.locator('.palette-color-control')).toBeVisible()
  await skip.click()
  await launcher.locator('.launcher-segments').getByText('Indexed', { exact: true }).click()
  await launcher.getByRole('button', { name: 'Create sprite', exact: true }).click()
  const canvas = page.getByTestId('pixel-canvas')
  await expect(canvas).toBeVisible()
  await expect(page.locator('.canvas-palette-empty')).toContainText('Colors appear as you draw')
  const box = await canvas.boundingBox()
  await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } })
  await expect(page.getByRole('button', { name: 'Use #D946EF as primary color' })).toBeVisible()
})

test('organizes projects in nested sprite suites from Home and the project launcher', async ({
  page,
}) => {
  const homeFolders = page.getByRole('complementary', { name: 'Project folders' }).first()
  await homeFolders.getByRole('button', { name: 'Create project folder' }).click()
  await homeFolders.getByRole('textbox', { name: 'Folder name' }).fill('Hero set')
  await homeFolders.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(homeFolders.locator('.project-folder-row > button').first()).toContainText(
    'Hero set',
  )
  await homeFolders.getByRole('button', { name: 'Create subfolder in Hero set' }).click()
  await homeFolders.getByRole('textbox', { name: 'Folder name' }).fill('Winter variants')
  await homeFolders.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(homeFolders.getByText('Winter variants', { exact: true })).toBeVisible()
  await expect(homeFolders.getByRole('textbox', { name: 'Folder name' })).toBeHidden()
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'project-suites-home.png') })

  await page.getByRole('button', { name: 'New sprite', exact: true }).first().click()
  const launcher = page.getByTestId('project-launcher')
  await expect(launcher.getByLabel('Sprite suite')).toHaveValue(/folder_/)
  await enterEditor(page, { name: 'Snow hero' })
  await page.getByRole('tab', { name: 'Home', exact: true }).click()
  await expect(page.locator('.home-recent-item').filter({ hasText: 'Snow hero' })).toBeVisible()
  await expect(page.getByText('Winter variants', { exact: true }).first()).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('app-splash')).toBeHidden({ timeout: 30_000 })
  await expect(page.getByRole('main', { name: /Your studio starts on this device/ })).toBeHidden()
  const restoredFolders = page.getByRole('complementary', { name: 'Project folders' }).first()
  await expect(restoredFolders.getByText('Hero set', { exact: true })).toBeVisible()
  await expect(restoredFolders.getByText('Winter variants', { exact: true })).toBeVisible()
  await expect(page.locator('.home-recent-item').filter({ hasText: 'Snow hero' })).toBeVisible()
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

  await expect.poll(() => alphaTotal(0)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Add fresh layer' }).click()
  await expect(layerRows).toHaveCount(2)
  await expect.poll(() => alphaTotal(0)).toBe(0)
  await expect.poll(() => alphaTotal(1)).toBeGreaterThan(0)

  await canvas.click({ position: { x: canvasBox!.width / 2 + 16, y: canvasBox!.height / 2 } })
  await expect.poll(() => alphaTotal(0)).toBeGreaterThan(0)
  await page.keyboard.press('F2')
  await page.getByRole('textbox', { name: 'Layer name' }).fill('Highlights')
  await page.getByRole('textbox', { name: 'Layer name' }).press('Enter')
  await expect(layerRows.nth(0).getByText('Highlights', { exact: true })).toBeVisible()

  await layerRows.nth(1).getByRole('button', { name: /Hide/ }).click()
  await expect.poll(() => alphaTotal(0)).toBeGreaterThan(0)
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

test('shows line, rectangle, and circle previews before committing', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Undo' }).click()
  await page.getByTestId('tool-circle').click()
  const circleBase = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
  await page.mouse.move(box!.x + box!.width * 0.3, box!.y + box!.height * 0.28)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.68, box!.y + box!.height * 0.68)
  expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(
    circleBase,
  )
  await page.screenshot({ path: resolve(snapshotDirectory, 'circle-tool-preview.png') })
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()
})

test('paints with mouse-selected colors, mirror axes, and dithering', async ({ page }) => {
  await enterEditor(page)
  const canvas = page.getByTestId('pixel-canvas')
  const zoom = Number(await page.getByLabel('Canvas zoom').getAttribute('data-zoom'))
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
  await expect.poll(async () => (await readPixel(5, 7)).slice(0, 3)).toEqual([255, 0, 0])
  await expect.poll(async () => (await readPixel(26, 7)).slice(0, 3)).toEqual([255, 0, 0])

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
  await expect.poll(async () => (await readPixel(14, 14)).slice(0, 3)).toEqual([255, 0, 0])
  await expect.poll(async () => (await readPixel(15, 14)).slice(0, 3)).toEqual([0, 255, 0])
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'mirror-dither-tools.png') })
})

test('moves, resizes, and rotates rectangular or lasso selections', async ({ page }) => {
  await enterEditor(page)
  const canvas = page.getByTestId('pixel-canvas')
  const zoom = Number(await page.getByLabel('Canvas zoom').getAttribute('data-zoom'))
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

  const canvasBox = (await canvas.boundingBox())!
  const resizedSelectionBefore = await canvas.evaluate((element: HTMLCanvasElement) =>
    element.toDataURL(),
  )
  await page.mouse.move(canvasBox.x + 11 * zoom - 5, canvasBox.y + 10 * zoom - 5)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + point(14, 12).x, canvasBox.y + point(14, 12).y)
  await page.mouse.up()
  expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(
    resizedSelectionBefore,
  )

  const rotationStart = { x: canvasBox.x + 11 * zoom, y: canvasBox.y + 6 * zoom - 11 }
  const rotatedSelectionBefore = await canvas.evaluate((element: HTMLCanvasElement) =>
    element.toDataURL(),
  )
  await page.mouse.move(rotationStart.x, rotationStart.y)
  await page.mouse.down()
  await page.keyboard.down('Shift')
  await page.mouse.move(canvasBox.x + 16 * zoom, canvasBox.y + 9.5 * zoom)
  await page.keyboard.up('Shift')
  await page.mouse.up()
  expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(
    rotatedSelectionBefore,
  )
  await page.screenshot({ path: resolve(snapshotDirectory, 'selection-transform-handles.png') })
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
  await page.getByRole('button', { name: 'View', exact: true }).click()
  const onionSkin = page.getByRole('menuitemcheckbox', { name: /Onion skin/ })
  await expect(onionSkin).toHaveAttribute('aria-checked', 'true')
  await onionSkin.click()
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: /Onion skin/ })).toHaveAttribute(
    'aria-checked',
    'false',
  )
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

test('toggles Live View and edits frame delay from the frame context menu', async ({ page }) => {
  await enterEditor(page)
  const timeline = page.getByRole('region', { name: 'Frames' })
  await expect(
    timeline.getByRole('button', { name: /Scroll frames|Play animation|Pause animation/ }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('spinbutton', { name: 'Active frame delay in milliseconds' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'View', exact: true }).click()
  let liveViewToggle = page.getByRole('menuitemcheckbox', { name: /Live view/ })
  await expect(liveViewToggle).toHaveAttribute('aria-checked', 'true')
  await liveViewToggle.click()
  await expect(page.getByRole('region', { name: 'Live preview', exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'View', exact: true }).click()
  liveViewToggle = page.getByRole('menuitemcheckbox', { name: /Live view/ })
  await liveViewToggle.click()
  await expect(page.getByRole('region', { name: 'Live preview', exact: true })).toBeVisible()
  await openFrameActions(page)
  const frameDelay = page.getByRole('spinbutton', { name: 'Frame delay in milliseconds' })
  await expect(frameDelay).toHaveValue('120')
  await frameDelay.fill('180')
  await frameDelay.press('Enter')
  await expect(page.locator('.frame-delay').first()).toHaveText('180ms')
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'live-view-frame-timing.png') })
  await page.keyboard.press('Escape')
  await timeline.getByRole('button', { name: 'Hide frames' }).click()
  await expect(timeline).toHaveClass(/collapsed/)
  await expect(page.getByTestId('app-shell')).toHaveClass(/timeline-collapsed/)
  await timeline.getByRole('button', { name: 'Show frames' }).click()
  await expect(timeline).not.toHaveClass(/collapsed/)
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

test('zooms toward the pointer, scales the work grid, and pans with the hand tool', async ({
  page,
}) => {
  await enterEditor(page, { width: 64, height: 64 })
  const zoomInput = page.getByLabel('Canvas zoom')
  const scrollHost = page.locator('.canvas-scroll')
  await page.getByRole('button', { name: 'View', exact: true }).click()
  const gridToggle = page.getByRole('menuitemcheckbox', { name: /Pixel grid/ })
  const transparencyToggle = page.getByRole('menuitemcheckbox', {
    name: /Transparency checkerboard/,
  })
  await expect(gridToggle).toHaveAttribute('aria-checked', 'true')
  await expect(transparencyToggle).toHaveAttribute('aria-checked', 'true')
  await transparencyToggle.click()
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await expect(
    page.getByRole('menuitemcheckbox', { name: /Transparency checkerboard/ }),
  ).toHaveAttribute('aria-checked', 'false')
  await expect(scrollHost).toHaveCSS('background-size', '14px 14px, 14px 14px')
  for (let step = 0; step < 6; step += 1) {
    await page.getByRole('button', { name: 'Zoom in' }).click()
  }
  await expect(zoomInput).toHaveAttribute('data-zoom', '20')
  await expect(scrollHost).toHaveCSS('background-size', '20px 20px, 20px 20px')
  await scrollHost.evaluate((element) => {
    element.scrollLeft = 160
    element.scrollTop = 160
  })
  const hostBoxBefore = (await scrollHost.boundingBox())!
  const pointer = {
    x: hostBoxBefore.x + hostBoxBefore.width * 0.66,
    y: hostBoxBefore.y + hostBoxBefore.height * 0.58,
  }
  const canvasBoxBefore = (await page.getByTestId('pixel-canvas').boundingBox())!
  const focusedPixelBefore = {
    x: (pointer.x - canvasBoxBefore.x) / 20,
    y: (pointer.y - canvasBoxBefore.y) / 20,
  }
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.wheel(0, -120)
  await expect(zoomInput).toHaveAttribute('data-zoom', '21')
  await expect(scrollHost).toHaveCSS('background-size', '21px 21px, 21px 21px')
  const canvasBoxAfter = (await page.getByTestId('pixel-canvas').boundingBox())!
  const focusedPixelAfter = {
    x: (pointer.x - canvasBoxAfter.x) / 21,
    y: (pointer.y - canvasBoxAfter.y) / 21,
  }
  expect(focusedPixelAfter.x).toBeCloseTo(focusedPixelBefore.x, 0)
  expect(focusedPixelAfter.y).toBeCloseTo(focusedPixelBefore.y, 0)

  for (let step = 0; step < 3; step += 1) {
    await page.getByRole('button', { name: 'Zoom in' }).click()
  }
  await expect(zoomInput).toHaveAttribute('data-zoom', '24')
  await page.getByTestId('tool-hand').click()
  await scrollHost.evaluate((element) => {
    element.scrollLeft = 160
    element.scrollTop = 160
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

  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(zoomInput).toHaveAttribute('data-zoom', '25')
  for (const expectedZoom of ['17', '9', '1']) {
    await zoomInput.fill('-8')
    await expect(zoomInput).toHaveValue('0')
    await expect(zoomInput).toHaveAttribute('data-zoom', expectedZoom)
  }
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
  await expect(page.getByRole('dialog', { name: 'Assistant Settings' })).toBeVisible()
  await page.getByRole('button', { name: 'Find models' }).click()
  await expect(page.getByLabel('Installed model')).toHaveValue('qwen2.5-coder:7b')
  await expect(page.getByText('Ollama is ready')).toBeVisible()
  await mkdir(snapshotDirectory, { recursive: true })
  await page.screenshot({ path: resolve(snapshotDirectory, 'ollama-connection-ready.png') })

  await page.getByRole('button', { name: /Compatible API/ }).click()
  await expect(page.getByLabel(/API key/)).toBeVisible()
  await page.getByRole('button', { name: /Codex CLI/ }).click()
  await expect(page.getByTestId('codex-runtime')).toBeVisible()
  await expect(page.getByLabel('Enable rendered vision')).toBeChecked()
  await expect(page.getByRole('textbox', { name: /Model override/ })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /Compatible API/ }).click()
  await page.getByRole('button', { name: /Codex CLI/ }).click()
  const dialogBox = await page.getByRole('dialog', { name: 'Assistant Settings' }).boundingBox()
  expect(dialogBox).not.toBeNull()
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390)
  expect(
    await page
      .locator('.provider-switch button')
      .first()
      .evaluate((button) => button.clientHeight),
  ).toBeGreaterThanOrEqual(44)
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
      messages: Array<{ content: string; images?: string[] }>
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
    expect(body.messages[1]!.images?.length).toBeGreaterThan(0)
    expect(body.messages[1]!.images!.length).toBeLessThanOrEqual(4)
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
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  const skillRack = page.locator('.assistant-skill-rack')
  await expect(skillRack.getByRole('button')).toHaveCount(6)
  await skillRack.getByRole('button', { name: 'Animate' }).click()
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
