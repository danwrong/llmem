# Memory Store

This repository contains your personal memories managed by LLMem.

## Structure

```
.
├── contexts/           # All memories organized by type
│   ├── personal/      # Personal experiences and thoughts
│   ├── project/       # Work and project-related memories
│   ├── knowledge/     # Learning and knowledge base
│   └── conversation/  # Past conversations and discussions
├── .llmem/            # Internal LLMem data (do not edit)
└── .gitignore         # Git ignore rules
```

## Memory Types

- **Personal**: Life experiences, thoughts, reflections, and personal notes
- **Project**: Work-related information, project details, and professional notes
- **Knowledge**: Facts, learnings, how-tos, and reference information
- **Conversation**: Records of important discussions and conversations

## File Format

Each memory is stored as a Markdown file with YAML frontmatter:

```markdown
---
id: 550e8400-e29b-41d4-a716-446655440000
title: My Memory Title
type: personal
tags: [example, memory]
created: 2024-01-15T10:30:00Z
updated: 2024-01-15T10:30:00Z
---

Memory content goes here...
```

## Usage

This repository is managed by LLMem. You can:
- Edit files directly (LLMem will detect changes)
- Use git to track history and collaborate
- Search and manage memories through your LLM interface

## Important Notes

- Don't modify files in `.llmem/` directory
- Keep the YAML frontmatter intact when editing
- Type subdirectories are created automatically as needed