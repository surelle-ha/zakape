from pathlib import Path

from playwright.sync_api import sync_playwright


root = Path.cwd()
snapshots = root / "docs" / "ui-snapshots"
snapshots.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    splash_context = browser.new_context(viewport={"width": 1440, "height": 960})
    page = splash_context.new_page()
    page.set_default_navigation_timeout(90_000)
    console_errors: list[str] = []
    page.on(
        "console",
        lambda message: console_errors.append(message.text) if message.type == "error" else None,
    )

    page.goto("http://127.0.0.1:3300/?splash=hold", wait_until="domcontentloaded")
    splash = page.get_by_test_id("app-splash")
    splash.wait_for(state="visible", timeout=60_000)
    page.screenshot(path=str(snapshots / "app-splash.png"))

    splash_context.close()
    app_context = browser.new_context(viewport={"width": 1440, "height": 960})
    page = app_context.new_page()
    page.set_default_navigation_timeout(90_000)
    page.on(
        "console",
        lambda message: console_errors.append(message.text) if message.type == "error" else None,
    )
    page.goto("http://127.0.0.1:3300", wait_until="domcontentloaded")
    splash = page.get_by_test_id("app-splash")
    page.get_by_test_id("project-hub").wait_for(state="visible", timeout=60_000)
    splash.wait_for(state="hidden", timeout=60_000)
    page.wait_for_load_state("networkidle")
    page.get_by_text("Indexing Documents/zakape…", exact=True).wait_for(
        state="hidden", timeout=30_000
    )

    assert page.get_by_test_id("app-titlebar").is_visible()
    assert page.get_by_role("button", name="Minimize window").is_visible()
    assert page.get_by_role("button", name="Maximize window").is_visible()
    assert page.get_by_role("button", name="Close window").is_visible()
    assert page.get_by_text("Documents/zakape", exact=True).is_visible()

    page.get_by_role("button", name="File", exact=True).click()
    assert page.get_by_role("menuitem", name="New sprite").is_visible()
    assert page.get_by_role("menuitem", name="Open project").is_visible()
    page.keyboard.press("Escape")
    page.evaluate("document.activeElement?.blur()")
    page.screenshot(path=str(snapshots / "project-home.png"))

    page.get_by_role("button", name="Create sprite").click()
    page.get_by_test_id("pixel-canvas").wait_for(state="visible", timeout=30_000)
    page.wait_for_function(
        "document.querySelector('.save-state')?.textContent?.includes('Restoring') === false"
    )
    page.get_by_test_id("assistant-scope-sheet").click()
    assert page.get_by_test_id("assistant-scope-sheet").get_attribute("aria-pressed") == "true"
    page.screenshot(path=str(snapshots / "studio-workbench.png"))

    if console_errors:
        raise AssertionError("Browser console errors: " + " | ".join(console_errors))

    browser.close()

print("workspace QA passed: splash, project home, titlebar menus, window controls, editor scope")
