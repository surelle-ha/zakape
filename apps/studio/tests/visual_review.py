from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT_DIRECTORY = Path(__file__).resolve().parents[3] / "test-results" / "visual-review"
BASE_URL = "http://127.0.0.1:3300"


def wait_for_studio(page):
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.get_by_test_id("app-splash").wait_for(state="hidden", timeout=30_000)
    page.get_by_test_id("project-launcher").wait_for(state="hidden")
    page.get_by_role("status", name="Indexing your workspace…").wait_for(
        state="hidden", timeout=30_000
    )


def create_project(page, name, size=32):
    page.get_by_role("button", name="New sprite", exact=True).first.click()
    launcher = page.get_by_test_id("project-launcher")
    launcher.wait_for(state="visible")
    launcher.get_by_role("textbox", name="Project name").fill(name)
    launcher.get_by_role("spinbutton", name="Width").fill(str(size))
    launcher.get_by_role("spinbutton", name="Height").fill(str(size))
    launcher.get_by_role("button", name="Create sprite", exact=True).click()
    launcher.wait_for(state="hidden")
    page.wait_for_timeout(700)
    skip_tour = page.get_by_role("button", name="Skip tour")
    if skip_tour.is_visible():
        skip_tour.click()


def main():
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        splash = browser.new_page(viewport={"width": 1440, "height": 960})
        splash.goto(f"{BASE_URL}/?splash=hold", wait_until="domcontentloaded")
        splash.get_by_test_id("app-splash").wait_for(state="visible")
        splash.wait_for_function("document.fonts.status === 'loaded'")
        splash.wait_for_function(
            "document.querySelector('.splash-sprite')?.naturalWidth > 0"
        )
        splash.wait_for_timeout(600)
        splash.screenshot(path=OUTPUT_DIRECTORY / "splash-desktop.png")
        splash.close()

        desktop = browser.new_page(viewport={"width": 1440, "height": 960})
        desktop.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        wait_for_studio(desktop)
        desktop.get_by_role("tab", name="Home", exact=True).wait_for(state="visible")
        desktop.get_by_role("heading", name="Recent work").wait_for(state="visible")
        desktop.get_by_role("heading", name="Changelog").wait_for(state="visible")
        desktop.screenshot(path=OUTPUT_DIRECTORY / "home-desktop.png")

        desktop.get_by_role("button", name="New sprite", exact=True).first.click()
        launcher = desktop.get_by_test_id("project-launcher")
        launcher.get_by_role("textbox", name="Project name").fill("Visual review")
        launcher.get_by_role("radio", name="Sweetie 16", exact=False).click()
        desktop.screenshot(path=OUTPUT_DIRECTORY / "project-setup-desktop.png")
        launcher.get_by_role("button", name="Create sprite", exact=True).click()
        desktop.wait_for_timeout(700)
        skip_tour = desktop.get_by_role("button", name="Skip tour")
        if skip_tour.is_visible():
            skip_tour.click()
        desktop.get_by_label("Primary drawing color").click()
        picker = desktop.get_by_role("dialog", name="Primary color picker")
        picker.wait_for(state="visible")
        assert desktop.locator('input[type="color"]').count() == 0
        picker_box = picker.bounding_box()
        assert picker_box is not None
        assert picker_box["x"] >= 0 and picker_box["y"] >= 0
        assert picker_box["x"] + picker_box["width"] <= 1440
        assert picker_box["y"] + picker_box["height"] <= 960
        desktop.screenshot(path=OUTPUT_DIRECTORY / "color-picker-desktop.png")
        picker.get_by_role("button", name="Close color picker").click()
        desktop.get_by_role("button", name="Toggle layers panel").click()
        desktop.get_by_label("Layers inspector").wait_for(state="visible")
        desktop.screenshot(path=OUTPUT_DIRECTORY / "workbench-desktop.png")

        mobile = browser.new_page(
            viewport={"width": 412, "height": 839},
            user_agent=(
                "Mozilla/5.0 (Linux; Android 14; Pixel 7) "
                "AppleWebKit/537.36 Chrome/151.0 Mobile Safari/537.36"
            ),
            has_touch=True,
            is_mobile=True,
        )
        wait_for_studio(mobile)
        mobile.get_by_role("heading", name="Recent work").wait_for(state="visible")
        home = mobile.locator(".home-workspace")
        home.evaluate("element => { element.scrollTop = 120 }")
        mobile.wait_for_function(
            "document.querySelector('.home-workspace')?.classList.contains('is-scrolling')"
        )
        mobile.wait_for_timeout(1_000)
        assert "is-scrolling" not in (home.get_attribute("class") or "")
        home.evaluate("element => { element.scrollTop = 0 }")
        mobile.wait_for_timeout(1_000)
        has_horizontal_overflow = mobile.evaluate(
            "document.documentElement.scrollWidth > window.innerWidth"
        )
        assert not has_horizontal_overflow
        mobile.screenshot(path=OUTPUT_DIRECTORY / "home-mobile.png")

        create_project(mobile, "Pocket review", 32)
        mobile.get_by_role("region", name="Live preview", exact=True).wait_for(
            state="visible"
        )
        mobile.screenshot(path=OUTPUT_DIRECTORY / "workbench-mobile.png")

        tablet = browser.new_page(
            viewport={"width": 820, "height": 1180},
            has_touch=True,
            is_mobile=True,
        )
        wait_for_studio(tablet)
        create_project(tablet, "Tablet review", 48)
        tablet.get_by_role("button", name="Toggle layers panel").click()
        tablet.get_by_label("Layers inspector").wait_for(state="visible")
        tablet.screenshot(path=OUTPUT_DIRECTORY / "workbench-tablet.png")
        browser.close()

    assert not console_errors, "\n".join(console_errors)
    print(f"Visual review passed. Screenshots: {OUTPUT_DIRECTORY}")


if __name__ == "__main__":
    main()
