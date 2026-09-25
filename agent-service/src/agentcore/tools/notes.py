from agentcore.tools.tools import available_tools, tools_registery
from agentcore.config import Configs
import requests
from agentcore.context import mindSpaceId, access_token


url = Configs.BACKEND_SERVICE_URL+"/notes"
# accessToken = Configs.ACCESS_TOKEN

def createNote( title: str,content: str):
    print(url)

    response = requests.post(url= url, json={
        "mindSpaceId": mindSpaceId.get(),
        "title": title,
        "content": content
    }, headers={
        "Authorization": f"Bearer {access_token.get()}",
                "Content-Type": "application/json",
    })

    return {"response": response.text}


tools_registery[createNote.__name__] = createNote


create_note_tool = {
    "type": "function",
    "function": {
        "name": "createNote",
        "description": "Create a note. Preserve the user's title and content exactly as provided.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Exact value explicitly provided after the word title",
                },
                "content": {
                    "type": "string",
                    "description": "Exact value explicitly provided after the word content",
                },
                
            },
            "required": [ "title", "content"],
        },
    },
}

available_tools.append(create_note_tool)


def getAllNotes():
    response = requests.get(url= url, params={
            "mindSpaceId": mindSpaceId.get(),
        }, headers={
            "Authorization": f"Bearer {access_token.get()}",
                    "Content-Type": "application/json",
        })
    
    return {"response": response.text}

available_tools.append(getAllNotes)
tools_registery[getAllNotes.__name__]= getAllNotes