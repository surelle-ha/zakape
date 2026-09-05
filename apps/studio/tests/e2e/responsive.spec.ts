import { expect, test } from '@playwright/test'

const openEditor = async (page: import('@playwright/test').Page, name: string, size = 32) => {
  await expect(page.getByTestId('app-splash')).toBeHidden({ timeout: 30_000 })
  const authentication = page.getByRole('main', { name: /Your studio starts on this device/ })
  await expect(authentication).toBeVisible()
  await authentication.getByRole('button', { name: 'Continue as Guest' }).click()
  const launcher = page.getByTestId('project-launcher')
  await expect(launcher).toBeHidden()
  await page.getByRole('button', { name: 'New sprite', exact: true }).first().click()
  await expect(launcher).toBeVisible()
  await launcher.getByRole('textbox', { name: 'Project name' }).fill(name)
  await launcher.getByRole('spinbutton', { name: 'Width' }).fill(String(size))
  await launcher.getByRole('spinbutton', { name: 'Height' }).fill(String(size))
  await launcher.getByRole('button', { name: 'Create sprite', exact: true }).click()
  await expect(page.getByTestId('project-launcher')).toBeHidden()
  await expect(page.getByTestId('pixel-canvas')).toBeVisible()
  const skipTour = page.getByRole('button', { name: 'Skip tour' })
  const tourOpened = await skipTour
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false)
  if (tourOpened) await skipTour.click()
}

test.describe('phone workbench', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Mobile Safari/537.36',
    viewport: { width: 412, height: 839 },
    screen: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  })

  test('keeps the desktop-only Godot handoff understandable on a phone', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-splash')).toBeHidden({ timeout: 30_000 })
    const authentication = page.getByRole('main', { name: /Your studio starts on this device/ })
    await authentication.getByRole('button', { name: 'Continue as Guest' }).click()
    await page.getByRole('button', { name: 'Godot Bridge', exact: true }).click()

    const bridge = page.getByRole('dialog', { name: 'Godot Bridge' })
    await expect(bridge).toBeVisible()
    const bounds = await bridge.boundingBox()
    expect(bounds!.width).toBe(412)
    expect(bounds!.height).toBe(839)
    await expect(bridge).toContainText('filesystem access sandboxed')
    await bridge.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(bridge).toBeHidden()
  })

  test('keeps drawing, tools, layers, and frames reachable by touch', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-titlebar')).toBeHidden()
    await expect(page.getByRole('contentinfo', { name: 'Application status' })).toBeHidden()
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /maximum-scale=1, user-scalable=no/,
    )
    await expect(page.getByTestId('project-launcher')).toBeHidden()
    await openEditor(page, 'Pocket courier')

    const tabsBox = await page.locator('.document-tabs').boundingBox()
    const timelineBox = await page.getByRole('region', { name: 'Animation timeline' }).boundingBox()
    expect(tabsBox!.y).toBeGreaterThan(timelineBox!.y)
    await expect(page.getByRole('button', { name: 'Keyboard shortcuts' })).toBeHidden()
    await expect(page.locator('.tool-button').first().locator('span')).toBeHidden()
    await expect(page.getByRole('region', { name: 'Live preview', exact: true })).toBeVisible()

    const canvas = page.getByTestId('pixel-canvas')
    const canvasSignature = () =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const pixels = element
          .getContext('2d')!
          .getImageData(0, 0, element.width, element.height).data
        let total = 0
        for (let offset = 0; offset < pixels.length; offset += 4) {
          total += pixels[offset]! * 3 + pixels[offset + 1]! * 5 + pixels[offset + 2]! * 7
        }
        return total
      })
    const before = await canvasSignature()
    const canvasBox = await canvas.boundingBox()
    await page.touchscreen.tap(
      canvasBox!.x + canvasBox!.width / 2,
      canvasBox!.y + canvasBox!.height / 2,
    )
    expect(await canvasSignature()).not.toBe(before)

    const zoomControl = page.getByLabel('Canvas zoom')
    const initialZoom = Number(await zoomControl.inputValue())
    const centerX = Math.max(90, Math.min(322, canvasBox!.x + canvasBox!.width / 2))
    const centerY = Math.max(150, Math.min(650, canvasBox!.y + canvasBox!.height / 2))
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: centerX - 24, y: centerY },
        { x: centerX + 24, y: centerY },
      ],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: centerX - 70, y: centerY },
        { x: centerX + 70, y: centerY },
      ],
    })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect
      .poll(async () => Number(await zoomControl.inputValue()))
      .toBeGreaterThan(initialZoom)

    const zoomedIn = Number(await zoomControl.inputValue())
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: centerX - 68, y: centerY },
        { x: centerX + 68, y: centerY },
      ],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: centerX - 22, y: centerY },
        { x: centerX + 22, y: centerY },
      ],
    })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => Number(await zoomControl.inputValue())).toBeLessThan(zoomedIn)

    const railBox = await page.getByRole('navigation', { name: 'Drawing tools' }).boundingBox()
    const canvasWorkspaceBox = await page
      .getByRole('region', { name: 'Canvas workspace' })
      .boundingBox()
    expect(railBox!.y).toBeGreaterThan(canvasWorkspaceBox!.y)
    expect(railBox!.width).toBeGreaterThan(railBox!.height * 4)
    await expect(page.getByRole('button', { name: 'Frame 1 actions' })).toBeVisible()

    await page.getByRole('button', { name: 'Toggle layers panel' }).click()
    await expect(page.getByLabel('Layers inspector')).toBeVisible()
    await page.getByRole('button', { name: 'Add fresh layer' }).click()
    await expect(page.locator('.layer-row')).toHaveCount(2)
    await page.getByRole('button', { name: 'Close layers panel' }).last().click()
    await expect(page.getByLabel('Layers inspector')).toBeHidden()

    await page.getByRole('button', { name: 'Frame 1 actions' }).click()
    await page.getByRole('menuitem', { name: /Copy frame to right/ }).click()
    await page.getByRole('button', { name: 'Frame 2 actions' }).click()
    await page.getByRole('menuitem', { name: /Copy frame to right/ }).click()
    const frames = page.locator('.frame-item')
    const initialOrder = await frames.evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).dataset.frameId),
    )
    const source = frames.first().locator('.frame-cell')
    const targetBox = await frames.nth(2).boundingBox()
    const sourceBox = await source.boundingBox()
    await source.dispatchEvent('pointerdown', {
      pointerType: 'touch',
      pointerId: 17,
      button: 0,
      clientX: sourceBox!.x + sourceBox!.width / 2,
      clientY: sourceBox!.y + sourceBox!.height / 2,
    })
    await page.waitForTimeout(450)
    await source.dispatchEvent('pointermove', {
      pointerType: 'touch',
      pointerId: 17,
      button: 0,
      clientX: targetBox!.x + targetBox!.width - 2,
      clientY: targetBox!.y + targetBox!.height / 2,
    })
    await source.dispatchEvent('pointerup', {
      pointerType: 'touch',
      pointerId: 17,
      button: 0,
      clientX: targetBox!.x + targetBox!.width - 2,
      clientY: targetBox!.y + targetBox!.height / 2,
    })
    await expect
      .poll(async () => frames.evaluateAll((items) => (items[2] as HTMLElement).dataset.frameId))
      .toBe(initialOrder[0])

    await expect(page).toHaveScreenshot('phone-workbench.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.015,
    })
  })

  test('keeps large-canvas strokes and fills bounded to one render per frame', async ({ page }) => {
    await page.addInitScript(() => {
      const metrics = { fillRects: 0, clears: 0, widthWrites: 0, heightWrites: 0 }
      Object.defineProperty(window, '__zakapeCanvasMetrics', { value: metrics })

      const canvasPrototype = HTMLCanvasElement.prototype
      const widthDescriptor = Object.getOwnPropertyDescriptor(canvasPrototype, 'width')!
      const heightDescriptor = Object.getOwnPropertyDescriptor(canvasPrototype, 'height')!
      Object.defineProperty(canvasPrototype, 'width', {
        ...widthDescriptor,
        set(value: number) {
          if (this.dataset.testid === 'pixel-canvas') metrics.widthWrites += 1
          widthDescriptor.set!.call(this, value)
        },
      })
      Object.defineProperty(canvasPrototype, 'height', {
        ...heightDescriptor,
        set(value: number) {
          if (this.dataset.testid === 'pixel-canvas') metrics.heightWrites += 1
          heightDescriptor.set!.call(this, value)
        },
      })

      const originalGetContext = canvasPrototype.getContext
      canvasPrototype.getContext = function (...args: Parameters<typeof originalGetContext>) {
        const context = originalGetContext.apply(this, args) as CanvasRenderingContext2D | null
        if (
          !context ||
          (context as CanvasRenderingContext2D & { metricsWrapped?: boolean }).metricsWrapped
        ) {
          return context
        }
        ;(context as CanvasRenderingContext2D & { metricsWrapped?: boolean }).metricsWrapped = true
        const originalFillRect = context.fillRect.bind(context)
        const originalClearRect = context.clearRect.bind(context)
        context.fillRect = (...fillArgs: Parameters<CanvasRenderingContext2D['fillRect']>) => {
          if (context.canvas.dataset.testid === 'pixel-canvas') metrics.fillRects += 1
          originalFillRect(...fillArgs)
        }
        context.clearRect = (...clearArgs: Parameters<CanvasRenderingContext2D['clearRect']>) => {
          if (context.canvas.dataset.testid === 'pixel-canvas') metrics.clears += 1
          originalClearRect(...clearArgs)
        }
        return context
      } as typeof originalGetContext
    })

    await page.goto('/')
    await openEditor(page, 'Large mobile study', 120)
    const canvas = page.getByTestId('pixel-canvas')
    const box = await canvas.boundingBox()
    const start = { x: box!.x + 22, y: box!.y + 34 }

    await page.mouse.move(start.x, start.y)
    await page.waitForTimeout(40)
    await page.evaluate(() => {
      Object.assign(
        (
          window as Window & {
            __zakapeCanvasMetrics: Record<string, number>
          }
        ).__zakapeCanvasMetrics,
        { fillRects: 0, clears: 0, widthWrites: 0, heightWrites: 0 },
      )
    })
    await page.mouse.down()
    await page.mouse.move(start.x + 76, start.y, { steps: 20 })
    await page.mouse.up()
    await page.waitForTimeout(80)

    const strokeMetrics = await page.evaluate(
      () =>
        (
          window as Window & {
            __zakapeCanvasMetrics: Record<string, number>
          }
        ).__zakapeCanvasMetrics,
    )
    expect(strokeMetrics.widthWrites).toBe(0)
    expect(strokeMetrics.heightWrites).toBe(0)
    expect(strokeMetrics.clears).toBeLessThanOrEqual(24)
    expect(strokeMetrics.fillRects).toBeLessThan(500)

    await page.keyboard.press('Control+z')
    await page.waitForTimeout(40)
    const afterUndo = await canvas.evaluate((element: HTMLCanvasElement) => {
      const data = element.getContext('2d')!.getImageData(22, 34, 1, 1).data
      return data[3]
    })
    expect(afterUndo).toBe(0)
    await page.keyboard.press('Control+y')
    await page.waitForTimeout(40)
    const afterRedo = await canvas.evaluate((element: HTMLCanvasElement) => {
      const data = element.getContext('2d')!.getImageData(22, 34, 1, 1).data
      return data[3]
    })
    expect(afterRedo).toBeGreaterThan(0)

    await page.getByTestId('tool-fill').click()
    await page.evaluate(() => {
      Object.assign(
        (
          window as Window & {
            __zakapeCanvasMetrics: Record<string, number>
          }
        ).__zakapeCanvasMetrics,
        { fillRects: 0, clears: 0, widthWrites: 0, heightWrites: 0 },
      )
    })
    await canvas.click({ position: { x: 350, y: 350 } })
    await page.waitForTimeout(80)
    const fillMetrics = await page.evaluate(
      () =>
        (
          window as Window & {
            __zakapeCanvasMetrics: Record<string, number>
          }
        ).__zakapeCanvasMetrics,
    )
    expect(fillMetrics.widthWrites).toBe(0)
    expect(fillMetrics.heightWrites).toBe(0)
    expect(fillMetrics.clears).toBeLessThanOrEqual(3)
    expect(fillMetrics.fillRects).toBeLessThan(250)
  })
})

test.describe('tablet workbench', () => {
  test.use({
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  })

  test('uses bottom document tabs and a side-sheet inspector', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-titlebar')).toBeHidden()
    await expect(page.getByTestId('app-splash')).toBeVisible()
    await expect(page.getByTestId('app-splash')).toBeHidden({ timeout: 30_000 })
    await expect(page.getByRole('contentinfo', { name: 'Application status' })).toBeHidden()
    await expect(page.getByTestId('project-launcher')).toBeHidden()

    await openEditor(page, 'Tablet tiles', 48)
    const railBox = await page.getByRole('navigation', { name: 'Drawing tools' }).boundingBox()
    const canvasWorkspaceBox = await page
      .getByRole('region', { name: 'Canvas workspace' })
      .boundingBox()
    expect(railBox!.x).toBeLessThan(canvasWorkspaceBox!.x)
    expect(railBox!.height).toBeGreaterThan(railBox!.width * 4)
    await expect(page.getByLabel('Layers inspector')).toBeHidden()
    await expect(page.getByRole('region', { name: 'Live preview', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keyboard shortcuts' })).toBeHidden()
    const tabsBox = await page.locator('.document-tabs').boundingBox()
    const timelineBox = await page.getByRole('region', { name: 'Animation timeline' }).boundingBox()
    expect(tabsBox!.y).toBeGreaterThan(timelineBox!.y)

    await page.getByRole('button', { name: 'Toggle layers panel' }).click()
    await expect(page.getByLabel('Layers inspector')).toBeVisible()
    const inspectorBox = await page.getByLabel('Layers inspector').boundingBox()
    expect(inspectorBox!.x).toBeGreaterThan(400)

    await expect(page).toHaveScreenshot('tablet-workbench.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.015,
    })
  })
})
