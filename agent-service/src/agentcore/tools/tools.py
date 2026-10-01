from datetime import datetime
from zoneinfo import ZoneInfo
import requests

available_tools= []
tools_registery= {}

def getTime(location: str) -> str:
    """Get the current time for a supported location."""

    timezones = {
        "dubai": "Asia/Dubai",
        "cairo": "Africa/Cairo",
        "baku": "Asia/Baku",
        "albania": "Europe/Tirane",
    }

    location_key = location.lower().strip()

    timezone = timezones.get(location_key)

    if not timezone:
        return f"Timezone for {location} is not supported"

    current_time = datetime.now(
        ZoneInfo(timezone)
    ).strftime("%I:%M %p")

    return current_time


available_tools.append(getTime)
tools_registery[getTime.__name__] = getTime

def getWeather(location: str):

    response = requests.get(f"https://wttr.in/{location}",
                             params={"format": "j1"},
                        timeout=10,
    )
    response.raise_for_status()
    # print(response.json())
    data = response.json()
    current = data["current_condition"][0]

    print(
        {
        "location": location,
        "temperature_c": current.get("temp_C"),
        "feels_like_c": current.get("FeelsLikeC"),
        "condition": current.get("weatherDesc", [{}])[0].get("value"),
        "humidity": current.get("humidity"),
        "wind_kmph": current.get("windspeedKmph"),
    }
    )
    return {
        "location": location,
        "temperature_c": current.get("temp_C"),
        "feels_like_c": current.get("FeelsLikeC"),
        "condition": current.get("weatherDesc", [{}])[0].get("value"),
        "humidity": current.get("humidity"),
        "wind_kmph": current.get("windspeedKmph"),
    }

available_tools.append(getWeather)
tools_registery[getWeather.__name__] = getWeather






