from agentcore.memory.memory import request_id
from agentcore.tools.tools import available_tools, tools_registery
from agentcore.config import Configs
import requests
from agentcore.context import mindSpaceId, access_token


url = Configs.BACKEND_SERVICE_URL+"/notes"
# accessToken = Configs.ACCESS_TOKEN

def createNote( title: str,content: str):
    """
    Create a new note in the user's current MindSpace.

    Preserve the user's title and content exactly as provided.

    Args:
        title: The exact note title provided by the user.
        content: The exact note content provided by the user.

    Returns:
        Dictionary containing the operation status and API response.
    """

    response = requests.post(url= url, json={
        "mindSpaceId": mindSpaceId.get(),
        "title": title,
        "content": content
    }, headers={
        "X-Request-ID": request_id.get(),
        "Authorization": f"Bearer {access_token.get()}",
                "Content-Type": "application/json",
    },
    timeout=(30, 60))

    if not response.ok:
        return {
        "ok": False,
        "status": response.status_code,
        "error": "REQUEST_FAILED",
    }

    return {
        "ok": True,
        "response": response.json(),
            }


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
    """
    Retrieve all notes from the user's current MindSpace.

    Use this tool when the user asks to view, list,
    or retrieve their saved notes.

    Returns:
        Dictionary containing the operation status and saved notes.
    """
    response = requests.get(url= url, params={
            "mindSpaceId": mindSpaceId.get(),
        }, headers={
            "X-Request-ID": request_id.get(),
            "Authorization": f"Bearer {access_token.get()}",
                    "Content-Type": "application/json",
        }, timeout=(30, 60))

    if not response.ok:
        return {
        "ok": False,
        "status": response.status_code,
        "error": "REQUEST_FAILED",
    }
    
    return {
        "ok": True,
        "response": response.json()
        }

available_tools.append(getAllNotes)
tools_registery[getAllNotes.__name__]= getAllNotes
