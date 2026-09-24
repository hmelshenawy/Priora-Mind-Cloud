from agentcore.tools.tools import available_tools, tools_registery
from agentcore.config import Configs
import requests

url = Configs.BACKEND_SERVICE_URL+"/tasks"
accessToken = Configs.ACCESS_TOKEN

def createTask(mindSpaceId: str,title: str,
               description: str,executor:str,
            #    accessToken:str
                ):
    
    print(url)

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

def getAllTasks(mindSpaceId: str):
    response = requests.get(url=url, params={
        "mindSpaceId": mindSpaceId
    }, headers={
        "Authorization": f"Bearer {accessToken}",
                "Content-Type": "application/json",
    })

    return {"response": response.text}

available_tools.append(getAllTasks)
tools_registery[getAllTasks.__name__]= getAllTasks