from agentcore.tools.tools import available_tools, tools_registery
from agentcore.config import Configs
import requests

url = Configs.BACKEND_SERVICE_URL+"/notes"
# accessToken = Configs.ACCESS_TOKEN

def createNote(accessToken: str, mindSpaceId:str, title: str,content: str):
    print(url)

    response = requests.post(url= url, json={
        "mindSpaceId": mindSpaceId,
        "title": title,
        "content": content
    }, headers={
        "Authorization": f"Bearer {accessToken}",
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
                "mindSpaceId": {
                    "type": "string",
                    "description": "Exact MindSpace ID provided by the user",
                },
                "title": {
                    "type": "string",
                    "description": "Exact value explicitly provided after the word title",
                },
                "content": {
                    "type": "string",
                    "description": "Exact value explicitly provided after the word content",
                },
                
            },
            "required": ["mindSpaceId", "title", "content"],
        },
    },
}

available_tools.append(create_note_tool)


def getAllNotes(accessToken: str, mindSpaceId: str):
    response = requests.get(url= url, params={
            "mindSpaceId": mindSpaceId,
        }, headers={
            "Authorization": f"Bearer {accessToken}",
                    "Content-Type": "application/json",
        })
    
    return {"response": response.text}

available_tools.append(getAllNotes)
tools_registery[getAllNotes.__name__]= getAllNotes