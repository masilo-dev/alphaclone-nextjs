import requests
import json

def debug_search():
    # Coords for Warsaw University of Technology
    lat = 52.2216
    lon = 21.0074
    delta = 0.05
    south, west = lat - delta, lon - delta
    north, east = lat + delta, lon + delta
    
    overpass_url = "https://overpass-api.de/api/interpreter"
    
    # Try a VERY simple query first to see if 406 persists
    query = f"""
    [out:json][timeout:15];
    node["amenity"="restaurant"]({south},{west},{north},{east});
    out body 5;
    """
    
    print("Testing simple restaurant query...")
    # Overpass expects data in the body, often as 'data=...' or just the raw query
    res = requests.post(overpass_url, data={'data': query})
    print(f"Status: {res.status_code}")
    if res.status_code != 200:
        print(f"Response: {res.text}")
        
    # Try raw body with text/plain
    print("\nTesting with text/plain raw body...")
    res = requests.post(overpass_url, data=query, headers={"Content-Type": "text/plain"})
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        print(f"Success! Found {len(res.json().get('elements', []))} restaurants.")
    else:
        print(f"Response: {res.text}")

if __name__ == "__main__":
    debug_search()
