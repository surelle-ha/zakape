import { expect, test } from '@playwright/test'

const openEditor = async (page: import('@playwright/test').Page, name: string, size = 32) => {
  await expect(page.getByTestId('app-splash')).toBeHidden({ timeout: 30_000 })
  const launcher = page.getByTestId('project-launcher')
  await expect(launcher).toBeVisible()
  await launcher.getByRole('button', { name: 'New sprite', exact: true }).click()
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

  test('keeps drawing, tools, layers, and frames reachable by touch', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-titlebar')).toBeHidden()
    await expect(page.getByRole('contentinfo', { name: 'Application status' })).toBeHidden()
    await openEditor(page, 'Pocket courier')

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

    await expect(page).toHaveScreenshot('phone-workbench.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.015,
    })
  })
})

test.describe('tablet workbench', () => {
  test.use({
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  })

  test('uses the compact launcher and a side-sheet inspector', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-titlebar')).toBeHidden()
    await expect(page.getByRole('contentinfo', { name: 'Application status' })).toBeVisible()
    await expect(page.getByRole('contentinfo', { name: 'Application status' })).toContainText(
      /v\d+\.\d+\.\d+/,
    )
    await expect(page.getByTestId('project-launcher')).toBeVisible()
    await expect(page).toHaveScreenshot('tablet-project-launcher.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.015,
    })

    await openEditor(page, 'Tablet tiles', 48)
    const railBox = await page.getByRole('navigation', { name: 'Drawing tools' }).boundingBox()
    const canvasWorkspaceBox = await page
      .getByRole('region', { name: 'Canvas workspace' })
      .boundingBox()
    expect(railBox!.x).toBeLessThan(canvasWorkspaceBox!.x)
    expect(railBox!.height).toBeGreaterThan(railBox!.width * 4)
    await expect(page.getByLabel('Layers inspector')).toBeHidden()

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
