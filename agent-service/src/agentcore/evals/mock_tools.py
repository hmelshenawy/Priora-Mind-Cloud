from langchain_core.tools import StructuredTool

"""This File is not used right now"""
def mock_tool(original_tool):

    def fake_execution(**kwargs):
        return {
            "ok": True,
            "mocked": True,
            "tool": original_tool.name,
        }

    return StructuredTool.from_function(
        func=fake_execution,
        name=original_tool.name,
        description=original_tool.description,
        args_schema=original_tool.args_schema,
    )


def build_mock_tools(tools):
    return [mock_tool(t) for t in tools]