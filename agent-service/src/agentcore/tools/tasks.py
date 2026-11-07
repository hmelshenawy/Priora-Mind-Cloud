from agentcore.memory.memory import request_id
from agentcore.tools.tools import available_tools, tools_registery
from agentcore.config import Configs
import requests
from agentcore.context import mindSpaceId, access_token

url = Configs.BACKEND_SERVICE_URL+"/tasks"


def createTask(title: str, description: str,executor:str,):
    """
    Create a new task in the user's current MindSpace.

    Use this tool when the user explicitly requests creating
    or scheduling a task.

    Before calling, ensure title, description, and executor
    are known. Infer values from conversation context only
    when they are clear. Otherwise, ask the user.

    Args:
        title: A concise title describing the task.
        description: Details describing what needs to be done.
        executor: Who should execute the task.
            USER means the user will perform it.
            AGENT means the AI agent is responsible.

    Returns:
        Dictionary containing the backend API response
        or an error status.
    """  
    

    response = requests.post(url=url, json={
                "mindSpaceId": mindSpaceId.get(),
                "title": title,
                "description": description,
                "executor": executor
            }, headers ={
        "X-Request-ID": request_id.get(),
        "Authorization": f"Bearer {access_token.get()}",
        "Content-Type": "application/json",
    },
    timeout=(60, 120)
            )

    if not response.ok:
        return{
            "ok": False,
            "status": response.status_code,
            "error": "Create Task Failed!!"
        }
    return {"response":response.json()}


# available_tools.append(createTask)
tools_registery[createTask.__name__] = createTask


create_task_tool = {
    "type": "function",
    "function": {
        "name": "createTask",
        "description": """Create a new task Before calling this tool, make sure title, description, and executor are known.
                        Use conversation context to infer them when they are clear.
                        If any required value cannot be reliably inferred, ask the user for it
                        instead of calling this tool.""",
        "parameters": {
            "type": "object",
            "properties": {
                
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
                "title",
                "description",
                "executor"
            ]
        }
    }
}

available_tools.append(create_task_tool)

def getAllTasks():
    """
    Retrieve all tasks from the user's current MindSpace.

    Use this tool when the user asks to list, view,
    or check their existing tasks.

    Returns:
        Dictionary containing the saved tasks
        or an error status.
    """
    response = requests.get(url=url, params={
        "mindSpaceId": mindSpaceId.get()
    }, headers={
        "X-Request-ID": request_id.get(),
        "Authorization": f"Bearer {access_token.get()}",
                "Content-Type": "application/json",
    },
    timeout=(60, 120))

    if not response.ok:
        return{
            "ok": False,
            "status": response.status_code,
            "error": "GET TASKS FAILED!!"
        }
    return {"response": response.json()}

available_tools.append(getAllTasks)
tools_registery[getAllTasks.__name__]= getAllTasks
