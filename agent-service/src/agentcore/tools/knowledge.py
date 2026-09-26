from agentcore.tools.tools import available_tools, tools_registery
from agentcore.config import Configs
import requests
from agentcore.context import mindSpaceId, access_token


def searchKnowledge( query: str) -> dict:
    """Search the user's uploaded PDFs, documents, and stored knowledge
    in the current MindSpace.

    Use this tool whenever the user asks about:
    - uploaded documents
    - PDFs
    - stored knowledge
    - facts that may exist in the current MindSpace

    Always search before saying that you cannot access the user's documents."""
      
    response = requests.post(
        f"{Configs.RAG_SERVICE_URL}/v1/search",
        json={
            "query": query,
            "topK": 5,
        "mindSpaceId": mindSpaceId.get(),
        }
    )

    print("STATUS:", response.status_code)
    print("BODY:", response.text)

    return response.json()


# available_tools.append(searchKnowledge)
tools_registery[searchKnowledge.__name__] = searchKnowledge

available_tools.append({
    "type": "function",
    "function": {
        "name": "searchKnowledge",
        "description": (
            "Search the user's uploaded PDFs, documents, and stored knowledge "
            "in the current MindSpace. Use this whenever the user asks about "
            "uploaded documents or stored knowledge."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "The search query extracted directly from the user's request. "
                        "For example, if the user asks 'What is the verification number?', "
                        "use 'verification number'."
                    )
                }
            },
            "required": ["query"]
        }
    }
})