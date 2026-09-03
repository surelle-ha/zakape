from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT_DIRECTORY = Path(__file__).resolve().parents[3] / "test-results" / "visual-review"
BASE_URL = "http://127.0.0.1:3300"


def wait_for_studio(page):
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    page.get_by_test_id("app-splash").wait_for(state="hidden", timeout=30_000)
    page.get_by_test_id("project-launcher").wait_for(state="visible")


def main():
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        desktop = browser.new_page(viewport={"width": 1440, "height": 960})
        desktop.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        wait_for_studio(desktop)
        desktop.get_by_role("button", name="Close project launcher").click()
        desktop.get_by_role("tab", name="Home", exact=True).wait_for(state="visible")
        desktop.get_by_role("heading", name="Recent work").wait_for(state="visible")
        desktop.get_by_role("heading", name="Changelog").wait_for(state="visible")
        desktop.screenshot(path=OUTPUT_DIRECTORY / "home-desktop.png")

        desktop.get_by_role("button", name="New sprite", exact=True).click()
        launcher = desktop.get_by_test_id("project-launcher")
        launcher.get_by_role("textbox", name="Project name").fill("Visual review")
        launcher.get_by_role("button", name="Create sprite", exact=True).click()
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
        mobile.get_by_role("button", name="Close project launcher").click()
        mobile.get_by_role("heading", name="Recent work").wait_for(state="visible")
        has_horizontal_overflow = mobile.evaluate(
            "document.documentElement.scrollWidth > window.innerWidth"
        )
        assert not has_horizontal_overflow
        mobile.screenshot(path=OUTPUT_DIRECTORY / "home-mobile.png")
        browser.close()

    assert not console_errors, "\n".join(console_errors)
    print(f"Visual review passed. Screenshots: {OUTPUT_DIRECTORY}")


if __name__ == "__main__":
    main()
