# Memory Store

This repository contains your personal memories managed by LLMem.

## Structure

```
.
├── contexts/           # All memories (organize however you like)
│   └── [your subdirs] # Create any directory structure that works for you
├── .llmem/            # Internal LLMem data (do not edit)
└── .gitignore         # Git ignore rules
```

## Organization Tips

You can organize your memories however makes sense to you:
- By date: `contexts/2024/january/`
- By project: `contexts/work/project-x/`
- By topic: `contexts/recipes/`, `contexts/travel/`
- By type: `contexts/personal/`, `contexts/knowledge/`
- Or any combination!

LLMem will find your memories regardless of how you organize them.

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