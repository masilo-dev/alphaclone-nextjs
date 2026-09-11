import asyncio
import json
import os
import sys
from typing import List, Dict
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
import requests

# ---------------------------------------------------------------------------
# Python Scraping Utility for AlphaClone Business OS
# ---------------------------------------------------------------------------
# This script demonstrates using the newly installed Python scraping stack:
# - Playwright (Python) for dynamic rendering
# - BeautifulSoup4 for HTML parsing
# - Requests for simple HTTP calls
# ---------------------------------------------------------------------------

class PythonScraper:
    def __init__(self):
        self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

    async def scrape_leads_playwright(self, niche: str, location: str, limit: int = 10) -> List[Dict]:
        """
        Scrapes leads using Playwright (Python version).
        Example: Scrapes DuckDuckGo for business info.
        """
        print(f"[PythonScraper] Starting Playwright scrape for '{niche}' in '{location}'...")
        results = []
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(user_agent=self.user_agent)
            
            query = f"{niche} {location} business contact"
            url = f"https://duckduckgo.com/?q={query.replace(' ', '+')}"
            
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                # Wait for results to load
                await page.wait_for_selector(".react-results--main", timeout=10000)
                
                content = await page.content()
                soup = BeautifulSoup(content, 'html.parser')
                
                # Extract results
                articles = soup.select("article[data-testid='result']")
                for article in articles[:limit]:
                    title_el = article.select_one("h2")
                    link_el = article.select_one("a[data-testid='result-title-a']")
                    snippet_el = article.select_one("div[data-result='snippet']")
                    
                    if title_el and link_el:
                        name = title_el.get_text().strip()
                        website = link_el.get('href', '')
                        snippet = snippet_el.get_text().strip() if snippet_el else ""
                        
                        results.append({
                            "business_name": name,
                            "website": website,
                            "snippet": snippet,
                            "source": "python_playwright"
                        })
                
            except Exception as e:
                print(f"[PythonScraper] Playwright Error: {e}")
            finally:
                await browser.close()
                
        return results

    def scrape_leads_bs4(self, niche: str, location: str, limit: int = 10) -> List[Dict]:
        """
        Scrapes leads using Requests + BeautifulSoup (Static HTML).
        """
        print(f"[PythonScraper] Starting BeautifulSoup scrape for '{niche}' in '{location}'...")
        results = []
        
        query = f"{niche} {location} business phone email"
        # Using DuckDuckGo HTML version for simpler parsing
        url = f"https://html.duckduckgo.com/html/?q={query.replace(' ', '+')}"
        
        headers = {"User-Agent": self.user_agent}
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            result_blocks = soup.select(".result")
            
            for block in result_blocks[:limit]:
                title_link = block.select_one(".result__a")
                snippet = block.select_one(".result__snippet")
                
                if title_link:
                    name = title_link.get_text().strip()
                    website = title_link.get('href', '')
                    desc = snippet.get_text().strip() if snippet else ""
                    
                    results.append({
                        "business_name": name,
                        "website": website,
                        "snippet": desc,
                        "source": "python_bs4"
                    })
                    
        except Exception as e:
            print(f"[PythonScraper] BS4 Error: {e}")
            
        return results

async def main():
    scraper = PythonScraper()
    niche = sys.argv[1] if len(sys.argv) > 1 else "Plumbers"
    location = sys.argv[2] if len(sys.argv) > 2 else "New York"
    
    # Run both methods to demonstrate
    bs4_leads = scraper.scrape_leads_bs4(niche, location, limit=5)
    pw_leads = await scraper.scrape_leads_playwright(niche, location, limit=5)
    
    all_leads = bs4_leads + pw_leads
    
    # Output as JSON for integration with JS
    print("\n--- SCRAPE RESULTS (JSON) ---")
    print(json.dumps(all_leads, indent=2))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python python_scraper.py <niche> <location>")
        # Default run for testing
        asyncio.run(main())
    else:
        asyncio.run(main())
