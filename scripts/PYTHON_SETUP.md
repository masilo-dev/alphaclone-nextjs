# AlphaClone Python Scraping Infrastructure

This directory contains Python-based scraping utilities that complement the Node.js production engine. The Python stack is designed for heavy, asynchronous, or batch-mode scraping operations that are too intensive for the Next.js serverless runtime.

## 🛠 Technology Stack

- **Python 3.12+** (Installed at `C:\Users\marekz\AppData\Local\Programs\Python\Python312`)
- **Beautiful Soup 4**: HTML parsing and data extraction.
- **Scrapy**: High-performance crawling framework.
- **Selenium & Playwright (Python)**: Browser automation for dynamic JS-heavy sites.
- **Requests & HTTPX**: Robust HTTP clients.

## 🚀 Environment Setup

To set up the Python environment on a new machine:

1. **Install Python 3.12** (ensure it's in your PATH).
2. **Install dependencies**:
   ```bash
   pip install -r scripts/requirements.txt
   ```
3. **Install Playwright Browser Binaries**:
   ```bash
   python -m playwright install chromium
   ```

### 💡 Troubleshooting PATH Issues
If `python` is not recognized in your terminal, use the full path:
```powershell
& "C:\Users\marekz\AppData\Local\Programs\Python\Python312\python.exe" scripts/python_scraper.py "Niche" "Location"
```

## 📂 Available Scripts

### `python_scraper.py`
A demonstration script showing how to use `BeautifulSoup` and `Playwright` together.
- **Usage**:
  ```bash
  python scripts/python_scraper.py "Plumbers" "Cape Town"
  ```
- **Output**: JSON formatted results ready for consumption by other services.

## 🔗 Integration with Node.js
You can trigger these Python scripts from the Node.js backend using `child_process`:

```typescript
import { exec } from 'child_process';

const runPythonScraper = (niche: string, location: string) => {
  return new Promise((resolve, reject) => {
    exec(`python scripts/python_scraper.py "${niche}" "${location}"`, (error, stdout, stderr) => {
      if (error) reject(error);
      // Parse JSON from stdout
      const jsonStart = stdout.indexOf('--- SCRAPE RESULTS (JSON) ---') + '--- SCRAPE RESULTS (JSON) ---'.length;
      const results = JSON.parse(stdout.substring(jsonStart));
      resolve(results);
    });
  });
};
```

## ⚠️ Important Notes
- **Local Only**: These tools are currently intended for local/offline batch discovery. 
- **Production Deployment**: If moving to a production microservice (Vercel doesn't support a full Python scraping stack easily), consider using a Dockerized container or a separate service like AWS Lambda (with a custom layer) or a dedicated VPS.
