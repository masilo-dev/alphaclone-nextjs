import requests

def debug_overpass():
    url = "https://overpass-api.de/api/interpreter"
    query = """
    [out:json][timeout:15];
    node(52.22,21.00,52.23,21.01);
    out body 1;
    """
    
    # Try with a browser-like User-Agent
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    print("Testing with Browser User-Agent and x-www-form-urlencoded...")
    res = requests.post(url, data={'data': query}, headers=headers)
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        print("Success!")
    else:
        print(f"Response: {res.text[:200]}")

    print("\nTesting with text/plain and AlphaClone User-Agent...")
    headers = {
        "User-Agent": "AlphaClone-LeadFinder/2.0 (support@alphaclonesystems.com)",
        "Content-Type": "text/plain"
    }
    res = requests.post(url, data=query, headers=headers)
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        print("Success!")
    else:
        print(f"Response: {res.text[:200]}")

if __name__ == "__main__":
    debug_overpass()
