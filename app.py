
import asyncio
import time

import httpx
import uvicorn
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

app = FastAPI(
    title="WeatherWise API",
    description="Weather search with location fallback",
    version="2.0.0",
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

# Simple in-memory cache for repeated searches.
location_cache = {}
CACHE_SECONDS = 3600

# Respect the public Nominatim service's request limit.
nominatim_lock = asyncio.Lock()
last_nominatim_request = 0.0


def normalize_open_meteo(place):
    name = place.get("name", "Unknown location")
    admin1 = place.get("admin1", "")
    admin2 = place.get("admin2", "")
    country = place.get("country", "")

    parts = [name]
    for part in (admin2, admin1, country):
        if part and part not in parts:
            parts.append(part)

    return {
        "name": name,
        "latitude": float(place["latitude"]),
        "longitude": float(place["longitude"]),
        "country": country,
        "admin1": admin1,
        "admin2": admin2,
        "display_name": ", ".join(parts),
        "source": "Open-Meteo",
    }


def normalize_nominatim(place):
    address = place.get("address", {})

    name = (
        place.get("name")
        or address.get("village")
        or address.get("town")
        or address.get("city")
        or address.get("hamlet")
        or address.get("county")
        or address.get("state")
        or address.get("country")
        or "Unknown location"
    )

    admin1 = address.get("state", "")
    admin2 = address.get("county", "")
    country = address.get("country", "")

    return {
        "name": name,
        "latitude": float(place["lat"]),
        "longitude": float(place["lon"]),
        "country": country,
        "admin1": admin1,
        "admin2": admin2,
        "display_name": place.get("display_name", name),
        "source": "OpenStreetMap",
    }


async def search_open_meteo(client, query):
    response = await client.get(
        GEOCODING_URL,
        params={
            "name": query,
            "count": 10,
            "language": "en",
            "format": "json",
        },
    )
    response.raise_for_status()

    data = response.json()
    return [
        normalize_open_meteo(place)
        for place in data.get("results", [])
    ]


async def search_nominatim(client, query):
    global last_nominatim_request

    cache_key = query.casefold()
    cached = location_cache.get(cache_key)

    if cached and time.time() - cached["time"] < CACHE_SECONDS:
        return cached["results"]

    async with nominatim_lock:
        # Check again after waiting for the lock.
        cached = location_cache.get(cache_key)
        if cached and time.time() - cached["time"] < CACHE_SECONDS:
            return cached["results"]

        # Nominatim's public server allows at most one request per second.
        wait = 1.1 - (time.monotonic() - last_nominatim_request)
        if wait > 0:
            await asyncio.sleep(wait)

        last_nominatim_request = time.monotonic()

        response = await client.get(
            NOMINATIM_URL,
            params={
                "q": query,
                "format": "jsonv2",
                "addressdetails": 1,
                "limit": 10,
            },
            headers={
                "User-Agent": "WeatherWise/2.0 (student weather project)"
            },
        )
        response.raise_for_status()

        results = [
            normalize_nominatim(place)
            for place in response.json()
        ]

        location_cache[cache_key] = {
            "time": time.time(),
            "results": results,
        }
        return results


async def find_locations(query):
    async with httpx.AsyncClient(timeout=15) as client:
        # Primary provider first.
        try:
            results = await search_open_meteo(client, query)
            if results:
                return results, "Open-Meteo"
        except (httpx.HTTPError, ValueError):
            pass

        # Fallback only if the primary search has no results or fails.
        try:
            results = await search_nominatim(client, query)
            if results:
                return results, "OpenStreetMap"
        except (httpx.HTTPError, ValueError):
            pass

    return [], None


@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={},
    )


@app.get("/api/locations")
async def get_locations(query: str = Query(default="")):
    query = query.strip()

    if len(query) < 2:
        return JSONResponse(
            status_code=400,
            content={"error": "Enter at least two characters."},
        )

    results, provider = await find_locations(query)

    if not results:
        return JSONResponse(
            status_code=404,
            content={
                "error": (
                    "No matching location was found, or location "
                    "services are temporarily unavailable. Try adding "
                    "the district, state, or country."
                )
            },
        )

    return {
        "query": query,
        "provider": provider,
        "results": results,
        "attribution": (
            "Location data: Open-Meteo / GeoNames or "
            "© OpenStreetMap contributors, depending on the result."
        ),
    }


async def get_weather_data(latitude, longitude):
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            WEATHER_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "current": (
                    "temperature_2m,"
                    "relative_humidity_2m,"
                    "apparent_temperature,"
                    "wind_speed_10m,"
                    "weather_code"
                ),
                "timezone": "auto",
            },
        )
        response.raise_for_status()
        data = response.json()

    return {
        "current": data["current"],
        "units": data["current_units"],
    }


@app.get("/api/weather")
async def get_weather(
    city: str = Query(default=""),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
):
    selected_name = city.strip()
    selected_location = None

    # Preferred method: fetch weather for a selected location's coordinates.
    if latitude is not None and longitude is not None:
        try:
            weather = await get_weather_data(latitude, longitude)
            return {
                "city": selected_name or "Selected location",
                "country": "",
                "admin1": "",
                **weather,
            }
        except (httpx.HTTPError, ValueError, KeyError):
            return JSONResponse(
                status_code=502,
                content={"error": "Weather data is temporarily unavailable."},
            )

    # Compatibility with the existing frontend's ?city=... request.
    if not selected_name:
        return JSONResponse(
            status_code=400,
            content={"error": "Please enter a location name."},
        )

    results, _ = await find_locations(selected_name)

    if not results:
        return JSONResponse(
            status_code=404,
            content={
                "error": (
                    "Location not found. Try including the state "
                    "and country."
                )
            },
        )

    selected_location = results[0]

    try:
        weather = await get_weather_data(
            selected_location["latitude"],
            selected_location["longitude"],
        )

        return {
            "city": selected_location["name"],
            "country": selected_location["country"],
            "admin1": selected_location["admin1"],
            **weather,
        }
    except (httpx.HTTPError, ValueError, KeyError):
        return JSONResponse(
            status_code=502,
            content={"error": "Weather data is temporarily unavailable."},
        )


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=5001,
        reload=True,
    )
