import requests
import os

GOOGLE_API_KEY = os.getenv("GOOGLE_SEARCH_API_KEY")
GOOGLE_CX = os.getenv("GOOGLE_SEARCH_CX")

# Returns a list of (title, snippet, link) tuples

def google_search(query, num_results=3):
    if not GOOGLE_API_KEY or not GOOGLE_CX:
        return []
    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": GOOGLE_API_KEY,
        "cx": GOOGLE_CX,
        "q": query,
        "num": num_results,
    }
    try:
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        results = []
        for item in data.get("items", []):
            results.append({
                "title": item.get("title"),
                "snippet": item.get("snippet"),
                "link": item.get("link")
            })
        return results
    except Exception:
        return []
