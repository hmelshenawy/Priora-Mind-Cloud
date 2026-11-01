from pathlib import Path
from abc import ABC, abstractmethod
from agentcore.context import  access_token
from agentcore.config import Configs
import requests

from langchain_core.tools import tool

class SkillProvider(ABC):
    def __init__(self):
        super().__init__()

    @abstractmethod
    def list(self):
        pass

    @abstractmethod
    def load_skill(self, identifier: str):
        pass


class BuildinSkillProvider(SkillProvider):
    def __init__(self):
        self.skills_path = Path(__file__).parent

    def list(self):
        skills = []

        for folder in self.skills_path.iterdir():
            skill_file = folder / "SKILL.md"

            if not folder.is_dir() or not skill_file.exists():
                continue

            text = skill_file.read_text(encoding="utf-8")

            name = None
            description = None

            for line in text.splitlines():
                if line.startswith("name:"):
                    name = line.split(":", 1)[1].strip()

                elif line.startswith("description:"):
                    description = line.split(":", 1)[1].strip()

                if name and description:
                    break

            if name and description:
                skills.append({
                    "name": name,
                    "description": description
                })
        print("AVAILABLE SKILSS: ", skills)
        return skills

    def load_skill(self, name: str):
        skill_file = self.skills_path / name / "SKILL.md"

        if not skill_file.exists():
            return f"Skill '{name}' not found"

        return skill_file.read_text(encoding="utf-8")


class UserSkillProvider(SkillProvider):
    def __init__(self):
        super().__init__()

    def list(self):
        url = f"{Configs.BACKEND_SERVICE_URL}"+"/user-skills"
        headers = {
            "Authorization": f"Bearer {access_token.get()}"
        }
        params = {
            "enabled": "true"
        }

        response = requests.get(
            url,
            headers=headers,
            params=params,
            timeout=15.0
        )

        response.raise_for_status()

        return response.json()["data"]

    def load_skill(self, identifier):
        url = f"{Configs.BACKEND_SERVICE_URL}/user-skills/{identifier}"

        headers = {
            "Authorization": f"Bearer {access_token.get()}"
        }

        response = requests.get(
            url,
            headers=headers,
            timeout=15.0
        )

        response.raise_for_status()

        return response.json()["data"]["instructions"]



class SkillManager:
    def __init__(self, builtin_provider, user_provider, tools, registry):
        self.builtin = builtin_provider
        self.user = user_provider

        tools.append(self.load_skill)
        registry["load_skill"] = self.load_skill

    # @tool
    def load_skill(self, identifier):
        """
    Load the full instructions of an available skill.

    Use this tool when a skill's description matches the user's request.
    The skill must be loaded before following its instructions.

    Supports built-in and user-created skills.
    Use the exact skill ID provided in the available skills list.

    Args:
        identifier: Exact skill identifier, including its source prefix.
            Examples: "builtin:planning" or "user:<skill-uuid>".

    Returns:
        The skill instructions, or an error if the skill is unavailable.
    """

        source, skill_id = identifier.split(":", 1)

        if source == "builtin":
            return self.builtin.load_skill(skill_id)

        if source == "user":
            return self.user.load_skill(skill_id)

        return "Unknown skill"