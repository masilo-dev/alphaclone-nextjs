import asyncio
from playwright.async_api import async_playwright

async def test_pw():
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto("https://example.com", timeout=30000)
            title = await page.title()
            print(f"Success: Found Title -> {title}")
            await browser.close()
            return True
        except Exception as e:
            print(f"Error: {e}")
            return False

if __name__ == "__main__":
    asyncio.run(test_pw())
