import requests
import json

def debug_search():
    location = "Warsaw University of Technology, Warsaw"
    niche = "HVAC"
    
    print(f"--- Debugging Search for '{niche}' in '{location}' ---")
    
    # 1. Geocode
    print("\n1. Geocoding via Nominatim...")
    geo_url = f"https://nominatim.openstreetmap.org/search?q={requests.utils.quote(location)}&format=json&limit=1"
    headers = {"User-Agent": "AlphaClone-Debug/1.0"}
    res = requests.get(geo_url, headers=headers)
    geo_data = res.json()
    
    if not geo_data:
        print("Geocoding failed!")
        return
        
    lat = float(geo_data[0]['lat'])
    lon = float(geo_data[0]['lon'])
    display_name = geo_data[0]['display_name']
    print(f"Found: {display_name}")
    print(f"Coords: {lat}, {lon}")
    
    # 2. OSM Overpass Test
    print("\n2. Testing OSM Overpass (radius 5km)...")
    delta = 0.045 # ~5km
    south, west = lat - delta, lon - delta
    north, east = lat + delta, lon + delta
    
    # Try multiple tags including Polish translations
    tags = ["HVAC", "Klimatyzacja", "Wentylacja", "Air Conditioning"]
    found_any = False
    
    for tag in tags:
        print(f"Searching tag: {tag}")
        query = f"""
        [out:json][timeout:15];
        (
          node["name"~"{tag}",i]({south},{west},{north},{east});
          node["amenity"~"{tag}",i]({south},{west},{north},{east});
          node["shop"~"{tag}",i]({south},{west},{north},{east});
          node["craft"~"{tag}",i]({south},{west},{north},{east});
          way["name"~"{tag}",i]({south},{west},{north},{east});
        );
        out center 10;
        """
        overpass_url = "https://overpass-api.de/api/interpreter"
        res = requests.post(overpass_url, data=query)
        if res.status_code == 200:
            data = res.json()
            elements = data.get('elements', [])
            print(f"  Found {len(elements)} elements for '{tag}'")
            if elements:
                found_any = True
                for el in elements[:3]:
                    print(f"    - {el.get('tags', {}).get('name')} ({el.get('tags', {}).get('craft') or el.get('tags', {}).get('shop')})")
        else:
            print(f"  Overpass Error: {res.status_code}")

    if not found_any:
        print("No results found in OSM for HVAC or translations in 5km radius.")

if __name__ == "__main__":
    debug_search()
