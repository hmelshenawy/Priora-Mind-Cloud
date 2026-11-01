from langchain_core.tools import tool

from agentcore.tools.tools import getDateTime, getWeather
from agentcore.tools.google_travel_api import (
    getDirections,
    getFlightSearchLink,
    getHotelSearchLink,
    searchActivities,
)
from agentcore.tools.knowledge import searchKnowledge
from agentcore.tools.pdf_generator import generate_pdf
from agentcore.tools.web_fetch import webFetch
from agentcore.tools.web_search import webSearch
from agentcore.tools.tasks import createTask, getAllTasks
from agentcore.tools.notes import createNote, getAllNotes

from agentcore.skills.skill_loader import SkillManager

langchain_tools = [
    tool(getDateTime),
    tool(getWeather),
    tool(getDirections),
    tool(getFlightSearchLink),
    tool(getHotelSearchLink),
    tool(searchActivities),
    tool(searchKnowledge),
    tool(generate_pdf),
    tool(webFetch),
    tool(webSearch),
    tool(createTask),
    tool(getAllTasks),
    tool(createNote),
    tool(getAllNotes),
    
]

def add_tool(tools_list, function):
    """Register a function as a LangChain tool."""
    registered_tool = tool(function)
    tools_list.append(registered_tool)
    return registered_tool