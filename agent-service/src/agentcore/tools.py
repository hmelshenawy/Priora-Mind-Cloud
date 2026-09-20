

registered_tools= []
tools_registery= {}

def getTime(location: str):
    return f"current time at {location} is 12:00 PM"

registered_tools.append(getTime)
tools_registery[getTime.__name__] = getTime