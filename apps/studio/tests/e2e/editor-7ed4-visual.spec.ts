import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

test('captures the plain authentication entry surface', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-splash')).toBeHidden({ timeout: 30_000 })
  const authentication = page.getByRole('main', { name: /Your studio starts on this device/ })
  await expect(authentication).toBeVisible()
  await expect(page.locator('.authentication-grid')).toHaveCount(0)
  await mkdir(resolve(process.cwd(), '../../docs/ui-snapshots'), { recursive: true })
  await page.screenshot({
    path: resolve(process.cwd(), '../../docs/ui-snapshots/authentication-entry.png'),
  })
})
