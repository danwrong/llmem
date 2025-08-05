# LLMem - Personal Context Store

A local-first personal memory system that provides LLMs with searchable access to your personal context through an MCP (Model Context Protocol) server.

## Features

- 📝 **Markdown-based storage** - Your contexts are stored as plain markdown files with YAML frontmatter
- 🔍 **Searchable** - Full-text search across all your personal contexts
- 🗂️ **Git-backed** - Automatic version control with commit history
- 🤖 **MCP Integration** - Direct access from Claude Desktop and other MCP-compatible clients
- 🔒 **Local-first** - Your data stays on your device
- ✅ **Fully tested** - Comprehensive test suite with 76+ tests

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/llmem.git
cd llmem

# Install dependencies
npm install

# Build the project (optional, for production use)
npm run build
```

## Quick Start

### 1. Initialize Your Context Store

The context store will be automatically created at `~/context-store/` when you first run the server.

### 2. Start the MCP Server

```bash
npm run mcp
```

The server will:
- Create the context store directory if it doesn't exist
- Initialize a git repository for version control
- Start listening for MCP commands via stdio

### 3. Add Some Contexts

You can add contexts manually by creating markdown files in `~/context-store/contexts/`:

```markdown
---
id: "550e8400-e29b-41d4-a716-446655440001"
title: "My Coffee Preferences"
type: "personal"
tags: ["coffee", "preferences"]
created: "2025-01-15T10:00:00Z"
updated: "2025-01-15T10:00:00Z"
relations: []
---

# My Coffee Preferences

I prefer medium roast coffee...
```

## Claude Desktop Integration

### 1. Configure Claude Desktop

Add LLMem to your Claude Desktop configuration:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "llmem": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/your/llmem",
      "env": {}
    }
  }
}
```

### 2. Restart Claude Desktop

Completely quit and restart Claude Desktop to pick up the configuration changes.

### 3. Test the Integration

In a new Claude conversation, you can verify LLMem is connected and test its features:

#### Check Connection
```
What MCP tools do you have access to?
```
Claude should list the 6 LLMem tools (search_context, get_context, add_context, etc.)

#### Search Your Contexts
```
Search my contexts for "coffee"
```
This will search across all your markdown files for the term "coffee"

#### Browse Recent Contexts
```
Show me my recent contexts
```
This displays your most recently modified contexts

#### View Context Statistics
```
What types of contexts do I have and how many of each?
```
Shows breakdown by type (personal, project, knowledge, conversation) and common tags

#### Retrieve Specific Context
```
Get the context titled "My Coffee Preferences"
```
Retrieves the full content of a specific context

#### Add New Context
```
Add a new personal context titled "Workspace Setup" with information about my preferred development environment, including VS Code settings, terminal setup, and favorite extensions
```
Creates a new markdown file in your context store

#### Update Existing Context
```
Update my "TypeScript Best Practices" context to include information about type guards and assertion functions
```
Modifies an existing context while preserving its ID and creation date

#### List Contexts by Type
```
Show me all my project contexts
```
Filters contexts to show only those of a specific type

#### Complex Searches
```
Search for contexts about "typescript" that are tagged with "programming"
```
Demonstrates filtered search with both query and tag constraints

## Manual Testing

You can test the MCP server directly from the command line:

### List Available Tools
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npm run mcp
```

### List Available Resources
```bash
echo '{"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}' | npm run mcp
```

### Search Contexts
```bash
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_context","arguments":{"query":"coffee"}}}' | npm run mcp
```

### Get a Specific Context
```bash
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_context","arguments":{"id":"550e8400-e29b-41d4-a716-446655440001"}}}' | npm run mcp
```

### List All Contexts
```bash
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"list_contexts","arguments":{}}}' | npm run mcp
```

### Read Recent Contexts Resource
```bash
echo '{"jsonrpc":"2.0","id":6,"method":"resources/read","params":{"uri":"context://recent"}}' | npm run mcp
```

### Read Context Types Resource
```bash
echo '{"jsonrpc":"2.0","id":7,"method":"resources/read","params":{"uri":"context://types"}}' | npm run mcp
```

### Add a New Context
```bash
echo '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"add_context","arguments":{"title":"Test from Console","content":"This is a test context created from the console","type":"knowledge","tags":["test","console"]}}}' | npm run mcp
```

## Available MCP Tools

- **search_context** - Search through contexts using natural language or keywords
- **get_context** - Retrieve a specific context by ID
- **add_context** - Create a new context entry
- **update_context** - Modify an existing context
- **delete_context** - Remove a context
- **list_contexts** - Browse contexts with optional filtering

## Available MCP Resources

- **context://recent** - Recently modified contexts
- **context://types** - Context type statistics and tag counts

## Context Types

- **personal** - Personal information and preferences
- **project** - Project-specific notes and documentation
- **knowledge** - Reference material and learning notes
- **conversation** - Meeting notes and conversation records

## Development

### Run Tests
```bash
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report
```

### Development Mode
```bash
npm run dev   # Start with file watching
```

### Build for Production
```bash
npm run build
npm start     # Run the built version
```

## Project Structure

```
llmem/
├── src/
│   ├── mcp/           # MCP server implementation
│   │   ├── server.ts
│   │   └── handlers/  # Tool and resource handlers
│   ├── storage/       # Storage layer
│   │   ├── context-store.ts
│   │   ├── git-store.ts
│   │   └── markdown-parser.ts
│   ├── models/        # TypeScript types and schemas
│   └── index.ts       # Entry point
├── context-store/     # Your personal contexts (auto-created)
└── tests/            # Test files
```

## Troubleshooting

### MCP Server Won't Start
- Make sure you have Node.js 18+ installed
- Check that all dependencies are installed: `npm install`
- Verify the context store directory has proper permissions

### Claude Desktop Can't Connect
- Ensure the config file path is correct for your OS
- Use absolute paths in the configuration
- Check that Claude Desktop was fully restarted
- Test the server manually with the console commands above

### Context Store Issues
- The store is created at `~/context-store/` by default
- You can change this in `src/utils/config.ts`
- Make sure you have write permissions in the parent directory

## Future Features

- 🔮 Vector search with semantic similarity
- 👁️ File watcher for auto-indexing external changes
- 💻 CLI for direct context management
- ☁️ Optional cloud sync via git remotes
- 🔐 Encryption for sensitive contexts

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.