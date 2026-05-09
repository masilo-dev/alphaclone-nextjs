import requests
from bs4 import BeautifulSoup
import json

def test_bs4():
    url = "https://example.com"
    try:
        res = requests.get(url, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        h1 = soup.select_one("h1").get_text()
        print(f"Success: Found H1 -> {h1}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_bs4()
