from datetime import datetime
from zoneinfo import ZoneInfo
import requests
from agentcore.config import Configs
from agentcore.schemas import TaskExecutor

registered_tools= []
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


registered_tools.append(getTime)
tools_registery[getTime.__name__] = getTime

def getWeather(location: str):
    return f"current weather at {location} is sunny with temprature -2C"

registered_tools.append(getWeather)
tools_registery[getWeather.__name__] = getWeather


def searchKnowledge(query: str) -> str:
    response = requests.post(
        f"{Configs.RAG_SERVICE_URL}/v1/search",
        json={
            "query": query,
            "topK": 5
        }
    )

    return response.json()


registered_tools.append(searchKnowledge)
tools_registery[searchKnowledge.__name__] = searchKnowledge



def createTask(mindSpaceId: str,title: str,
               description: str,executor:str,
            #    accessToken:str
                ):
    url = Configs.BACKEND_SERVICE_URL+"/api/v1/tasks"
    print(url)
    accessToken = Configs.ACCESS_TOKEN

    response = requests.post(url=url, json={
                "mindSpaceId": mindSpaceId,
                "title": title,
                "description": description,
                "executor": executor
            }, headers ={
        "Authorization": f"Bearer {accessToken}",
        "Content-Type": "application/json",
    },
            )
    print(response)

    return {"response":response.text}


registered_tools.append(createTask)
tools_registery[createTask.__name__] = createTask


create_task_tool = {
    "type": "function",
    "function": {
        "name": "createTask",
        "description": "Create a new task",
        "parameters": {
            "type": "object",
            "properties": {
                "mindSpaceId": {
                    "type": "string"
                },
                "title": {
                    "type": "string"
                },
                "description": {
                    "type": "string"
                },
                "executor": {
                    "type": "string",
                    "enum": ["USER", "AGENT"]
                }
            },
            "required": [
                "mindSpaceId",
                "title",
                "description",
                "executor"
            ]
        }
    }
}

registered_tools.append(create_task_tool)
