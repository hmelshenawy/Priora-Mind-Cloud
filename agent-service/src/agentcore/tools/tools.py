from datetime import datetime
import requests
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

available_tools= []
tools_registery= {}

def getDateTime(timezone:str = "UTC") -> str:
    """Get the current date and time in the user's local timezone."""

    try:
        now = datetime.now(ZoneInfo(timezone))

        return now.isoformat(timespec="seconds")

    except ZoneInfoNotFoundError:
        return "Invalid user timezone"


available_tools.append(getDateTime)
tools_registery[getDateTime.__name__] = getDateTime

def getWeather(location: str):
    """Get the current weather conditions for a location."""
    response = requests.get(f"https://wttr.in/{location}",
                             params={"format": "j1"},
                        timeout=10,
    )
    response.raise_for_status()
    # print(response.json())
    data = response.json()
    current = data["current_condition"][0]

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






