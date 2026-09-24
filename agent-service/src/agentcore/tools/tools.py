from datetime import datetime
from zoneinfo import ZoneInfo


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

    return f"Current time in {location} is {current_time}"


available_tools.append(getTime)
tools_registery[getTime.__name__] = getTime

def getWeather(location: str):
    return f"current weather at {location} is sunny with temprature -2C"

available_tools.append(getWeather)
tools_registery[getWeather.__name__] = getWeather






