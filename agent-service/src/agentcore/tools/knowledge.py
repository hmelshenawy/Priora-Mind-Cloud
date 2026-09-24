from agentcore.tools.tools import available_tools, tools_registery
from agentcore.config import Configs
import requests


def searchKnowledge(query: str) -> str:
    response = requests.post(
        f"{Configs.RAG_SERVICE_URL}/v1/search",
        json={
            "query": query,
            "topK": 5
        }
    )

    return response.json()


available_tools.append(searchKnowledge)
tools_registery[searchKnowledge.__name__] = searchKnowledge
