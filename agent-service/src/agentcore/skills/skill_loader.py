from pathlib import Path


class SkillLoader:
    def __init__(self, tools: list, tool_registry: dict):
        self.skills_path = Path(__file__).parent
        self.tool_registry = tool_registry
        self.tools = tools
        self.register_tool()

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


    def register_tool(self):
        self.tools.append(self.load_skill)
        self.tool_registry[self.load_skill.__name__] = self.load_skill
        print("SKILLS TOOL ADDED SUCCESSFULLY")
        