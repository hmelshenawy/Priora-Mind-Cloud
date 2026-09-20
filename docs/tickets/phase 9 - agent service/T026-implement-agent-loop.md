# T026 — Implement Agent Loop

## Phase
Phase 9 — Agent Service

## Goal
Turn basic tool calling into a real agent loop.

Current flow:

```text
User message
→ LLM
→ tool call
→ execute tool
→ return tool result
```

Target flow:

```text
User message
→ LLM
→ tool call?
    ├── no  → final answer
    └── yes → execute tool
              → append tool result
              → call LLM again
              → final answer
```

The user should receive the model's final natural-language response, not the raw tool output.

## Scope

Implement a small agent loop that:

- starts with the user message
- sends messages + available tools to the LLM
- detects tool calls
- executes requested tools
- appends the assistant tool-call message
- appends tool results
- calls the LLM again
- repeats until the model returns a normal final response
- stops after a maximum number of steps

Keep the implementation direct and small.

## Suggested Structure

```text
src/
└── agentcore/
    ├── main.py
    ├── config.py
    ├── schemas.py
    ├── llm.py
    ├── tools.py
    └── agent.py
```

Use `agent.py` for the loop.

Do not create a class unless it clearly improves the code.

A simple function is enough:

```python
def run_agent(user_input: str, max_steps: int = 5) -> str:
    ...
```

## Target Flow

```text
run_agent(user_input)
    ↓
messages = [system, user]
    ↓
for each step
    ↓
LLM(messages, tools)
    ↓
tool_calls?
 ├── no
 │    ↓
 │  return content
 │
 └── yes
      ↓
   append assistant message
      ↓
   execute tool
      ↓
   append tool result
      ↓
   next LLM call
```

## Tool Execution

Use the existing:

```text
registered_tools
tools_map
```

The LLM returns a tool name as a string.

Example:

```text
"getTime"
```

Resolve it through:

```python
tool = tools_map[tool_name]
```

Execute with:

```python
result = tool(**tool_args)
```

Support multiple tool calls returned in one model response if it is simple to do so.

Do not add parallel execution.

## Messages

The loop must preserve the conversation for the current request.

Conceptually:

```python
messages = [
    {"role": "system", "content": "..."},
    {"role": "user", "content": user_input},
]
```

After the LLM requests a tool, append the assistant message returned by Ollama.

Then append each tool result using the tool role.

The next LLM call must receive the updated messages.

## LLM Client

The low-level LLM client should accept:

```text
messages
tools
```

and return the Ollama response/message needed by the agent loop.

Do not hide tool calls by converting every response immediately into a string.

The agent loop needs access to:

```text
response.message.content
response.message.tool_calls
```

## Maximum Steps

Prevent infinite loops.

Example:

```python
MAX_STEPS = 5
```

If the model still requests tools after the limit, stop safely.

A simple fallback is enough, such as returning a clear error/fallback response.

Do not build a retry framework.

## API

The existing chat endpoint should call the agent runner.

Example:

```text
POST /chat
    ↓
run_agent(body.message)
    ↓
final answer
```

The endpoint should return the final answer.

Example:

```json
{
  "response": "The current time in Dubai is 12:00 PM."
}
```

It should no longer return:

```json
{
  "tool": "current time at dubai is 12:00 PM"
}
```

## Acceptance Criteria

- A dedicated agent loop exists.
- The loop keeps the current request's messages.
- The LLM can return a direct answer without using tools.
- The LLM can request a tool.
- The requested tool is executed.
- Tool arguments are passed correctly.
- Tool output is appended to messages.
- The LLM is called again after tool execution.
- The final response is natural-language model text.
- A maximum step limit exists.
- Existing registered tools continue to work.
- The API returns the final agent response.
- No RAG integration is added.
- No NestJS business tools are added.
- No persistent conversation history is added yet.

## Out of Scope

Do NOT implement:

- RAG tool
- NestJS tools
- persistent conversation history
- database storage
- memory
- authentication
- permissions
- background jobs
- queueing
- complex retry policies
- parallel tool execution
- generic workflow engine
- planner architecture
- multi-agent system
- provider factory

## Implementation Rules

- Keep the loop readable.
- Prefer one clear function.
- Do not over-engineer.
- Reuse `registered_tools` and `tools_map`.
- Keep business/tool logic outside the LLM client.
- Keep the LLM client focused on provider communication.
- Do not create abstractions for future providers unless needed now.

## Validation

Test at least:

### Case 1 — Direct answer

```text
User: "Say hello."
```

Expected:

```text
LLM returns final response without a tool call.
```

### Case 2 — Tool call

```text
User: "What time is it in Dubai?"
```

Expected flow:

```text
LLM
→ getTime(location="Dubai")
→ tool executes
→ result appended
→ LLM called again
→ final natural-language answer
```

### Case 3 — Step limit

Confirm the loop cannot run forever if the model repeatedly requests tools.

## Completion Report

When finished, report:

1. Files created.
2. Files modified.
3. Agent loop flow.
4. How tool calls are executed.
5. How tool results are appended.
6. Maximum step behavior.
7. Validation results.
8. Any deviation from the ticket and why.
