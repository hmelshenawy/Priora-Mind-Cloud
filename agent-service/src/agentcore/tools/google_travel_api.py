
from urllib.parse import urlencode
from agentcore.tools.tools import available_tools, tools_registery
from datetime import date

# -----------------------------------------
# GET FLIGHT SEARCH TOOL:

def getFlightSearchLink(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str | None = None,
    currency: str = "AED"
) -> str:
    """Generate a Google Flights search link.

    Args:
        origin: Departure airport IATA code, e.g. DXB
        destination: Arrival airport IATA code, e.g. TBS
        departure_date: Departure date YYYY-MM-DD
        return_date: Optional return date YYYY-MM-DD
        currency: Display currency, e.g. AED

    Returns:
        Google Flights search URL.
    """

    query = (
        f"Flights from {origin} to {destination} "
        f"on {departure_date}"
    )

    if return_date:
        query += f" returning {return_date}"
    else:
        query += " one way"

    params = urlencode({
        "q": query,
        "curr": currency,
        "hl": "en"
    })

    return f"https://www.google.com/travel/flights?{params}"


getFlightSearchLink_schema = {
    "type": "function",
    "function": {
        "name": "getFlightSearchLink",
        "description": "Generate a Google Flights search URL using departure and destination airports and travel dates. Does not retrieve flight prices.",
        "parameters": {
            "type": "object",
            "properties": {
                "origin": {
                    "type": "string",
                    "description": "Departure airport IATA code, e.g. DXB"
                },
                "destination": {
                    "type": "string",
                    "description": "Arrival airport IATA code, e.g. TBS"
                },
                "departure_date": {
                    "type": "string",
                    "description": "Departure date in YYYY-MM-DD format"
                },
                "return_date": {
                    "type": "string",
                    "description": "Optional return date in YYYY-MM-DD format"
                },
                "currency": {
                    "type": "string",
                    "description": "Currency code, defaults to AED"
                }
            },
            "required": [
                "origin",
                "destination",
                "departure_date"
            ]
        }
    }
}


tools_registery[getFlightSearchLink.__name__] = getFlightSearchLink
available_tools.append(getFlightSearchLink)


# --------------------------------------------------------
# GET HOTEL SEARCH TOOL:


def getHotelSearchLink(
    destination: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    currency: str = "AED",
) -> str:
    """Generate a Google Hotels search link.

    Args:
        destination: City or area, e.g. Batumi, Georgia
        check_in: Check-in date YYYY-MM-DD
        check_out: Check-out date YYYY-MM-DD
        adults: Number of adult guests
        currency: Preferred currency

    Returns:
        Google Hotels search URL.
    """

    start = date.fromisoformat(check_in)
    end = date.fromisoformat(check_out)

    if start < date.today():
        return "Invalid check-in date: date is in the past."

    if end <= start:
        return "Invalid check-out date."

    query = (
        f"Hotels in {destination} "
        f"from {check_in} to {check_out}"
    )

    params = urlencode({
        "q": query,
        "hl": "en",
        "curr": currency,
    })

    return (
        "https://www.google.com/travel/search?"
        + params
    )


available_tools.append(getHotelSearchLink)
tools_registery[getHotelSearchLink.__name__] = getHotelSearchLink



# --------------------------------------------------
# SEARCH ACTIVITY BY GOOGLE MAPS LINKS

def searchActivities(city: str, activity: str) -> str:
    """Generate a Google Maps activity search link.

    Args:
        city: Destination city, e.g. Tbilisi, Georgia
        activity: Activity category, e.g. forests, hiking, museums

    Returns:
        Google Maps search URL.
    """
    params = urlencode({
        "api": 1,
        "query": f"{activity} in {city}"
    })

    return f"https://www.google.com/maps/search/?{params}"

available_tools.append(searchActivities)
tools_registery[searchActivities.__name__] = searchActivities

# ------------------------------------------------------
#  SEARCH DIRECTION BY GOOGLE MAPS LINKS:
def getDirections(
    origin: str,
    destination: str,
    travel_mode: str = "driving"
) -> str:
    """Generate Google Maps directions link.

    Args:
        origin: Starting location
        destination: Target location
        travel_mode: driving, walking, transit, or bicycling

    Returns:
        Google Maps directions URL.
    """
    allowed = {"driving", "walking", "transit", "bicycling"}

    if travel_mode not in allowed:
        return "Invalid travel mode."

    params = urlencode({
        "api": 1,
        "origin": origin,
        "destination": destination,
        "travelmode": travel_mode
    })

    return f"https://www.google.com/maps/dir/?{params}"

available_tools.append(getDirections)
tools_registery[getDirections.__name__] = getDirections

