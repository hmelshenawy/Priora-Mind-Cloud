# T036 --- Agent Skills System

## Goal

Add a lightweight skills system that allows the Priora Agent to discover
and load specialized instructions only when needed, instead of placing
all skill instructions in the main system prompt.

## Scope

Create a filesystem-based skills directory inside `agent-service`.

``` text
src/agentcore/
├── skills/
│   ├── research/
│   │   └── SKILL.md
│   └── document-analysis/
│       └── SKILL.md
```

Each skill has a `SKILL.md` containing metadata and instructions.

``` md
---
name: research
description: Use when the user needs structured research.
---

# Research Skill

Instructions for performing research...
```

Implement a Skill Registry that exposes only lightweight metadata to the
agent.

Implement a `load_skill` tool accepting a skill name.

``` json
{
  "skill": "research"
}
```

Flow:

``` text
LLM
 ↓
load_skill("research")
 ↓
Skill Registry
 ↓
read skills/research/SKILL.md
 ↓
return skill instructions
 ↓
Agent adds instructions to context
 ↓
Agent continues loop
```

## Architectural Rule

The main system prompt contains only available skill names and short
descriptions. Full `SKILL.md` content is not included initially and is
loaded only when requested by the agent.

A loaded skill is instructions/context, not a replacement for the
existing tool system.

## Agent Behavior

The agent answers normally when no specialized skill is needed. When a
specialized workflow is useful, it selects the appropriate skill, calls
`load_skill`, receives the instructions, adds them to the current
context, and continues the normal agent loop.

Existing tools, RAG, memory, and streaming must continue working
unchanged.

## Error Handling

-   Unknown skill returns a controlled `skill not found` result.
-   Missing or malformed `SKILL.md` must not crash the agent.
-   Prevent repeated loading of the same skill within one agent run.

## Out of Scope

-   Database storage for skills
-   User-created skills
-   Skill marketplace
-   Automatic skill generation
-   Permissions system
-   Vector search for skills
-   Nested/sub-skills
-   Separate LLM for skill selection

Keep V1 filesystem-based and simple.

## Acceptance Criteria

-   Normal question → no skill loaded → normal answer.
-   Research-type question → agent selects `research` → `load_skill`
    called → `SKILL.md` loaded → agent continues and answers.
-   Invalid skill → safe controlled result.
-   Existing weather tool still works.
-   RAG still works.
-   Streaming still works.

## Design Principle

**Tools give the agent capabilities/actions. Skills give the agent
specialized instructions on how to perform a type of work.**
