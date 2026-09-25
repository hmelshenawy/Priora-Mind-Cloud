from agentcore.tools.tools import available_tools, tools_registery
from agentcore.config import Configs
import requests
from agentcore.context import mindSpaceId, access_token

url = Configs.BACKEND_SERVICE_URL+"/tasks"


def createTask(title: str,
               description: str,executor:str,
            #    accessToken:str
                ):
    
    print(url)

    response = requests.post(url=url, json={
                "mindSpaceId": mindSpaceId.get(),
                "title": title,
                "description": description,
                "executor": executor
            }, headers ={
        "Authorization": f"Bearer {access_token.get()}",
        "Content-Type": "application/json",
    },
            )
    print(response)

    return {"response":response.text}


available_tools.append(createTask)
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

available_tools.append(create_task_tool)

def getAllTasks():
    response = requests.get(url=url, params={
        "mindSpaceId": mindSpaceId.get()
    }, headers={
        "Authorization": f"Bearer {access_token.get()}",
                "Content-Type": "application/json",
    })

    return {"response": response.text}

available_tools.append(getAllTasks)
tools_registery[getAllTasks.__name__]= getAllTasks