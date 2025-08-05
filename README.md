# LLMem - Personal Memory Store

A local-first personal memory system that provides LLMs with searchable access to your personal memories through an MCP (Model Context Protocol) server.

## Features

- 📝 **Markdown-based storage** - Your memories are stored as plain markdown files with YAML frontmatter
- 🔍 **Searchable** - Full-text search across all your personal memories
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

### 1. Initialize Your Memory Store

The memory store will be automatically created at `~/context-store/` when you first run the server.

### 2. Start the MCP Server

```bash
npm run mcp
```

The server will:
- Create the memory store directory if it doesn't exist
- Initialize a git repository for version control
- Start listening for MCP commands via stdio

### 3. Add Some Memories

You can add memories manually by creating markdown files in `~/context-store/contexts/`:

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

#### Search Your Memories
```
Search my memories for "coffee"
```
This will search across all your markdown files for the term "coffee"

#### Browse Recent Memories
```
Show me my recent memories
```
This displays your most recently modified memories

#### View Memory Statistics
```
What types of memories do I have and how many of each?
```
Shows breakdown by type (personal, project, knowledge, conversation) and common tags

#### Retrieve Specific Memory
```
Get the memory titled "My Coffee Preferences"
```
Retrieves the full content of a specific memory

#### Add New Memory
```
Add a new personal memory titled "Workspace Setup" with information about my preferred development environment, including VS Code settings, terminal setup, and favorite extensions
```
Creates a new markdown file in your memory store. The LLM will intelligently organize it in an appropriate subdirectory (e.g., `contexts/tech/development/` or `contexts/2024/setup/`)

#### Add Memory with Custom Organization
```
Remember my trip to Tokyo in December 2024 - the amazing ramen at Ichiran, visiting Senso-ji temple, and staying in Shibuya
```
The LLM will automatically organize this in a logical directory like `contexts/travel/japan/2024/` or `contexts/2024/december/tokyo/`

#### Update Existing Memory
```
Update my "TypeScript Best Practices" memory to include information about type guards and assertion functions
```
Modifies an existing memory while preserving its ID and creation date

#### List Memories by Type
```
Show me all my project memories
```
Filters memories to show only those of a specific type

#### Complex Searches
```
Search for memories about "typescript" that are tagged with "programming"
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

### Search Memories
```bash
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_context","arguments":{"query":"coffee"}}}' | npm run mcp
```

### Get a Specific Memory
```bash
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_context","arguments":{"id":"550e8400-e29b-41d4-a716-446655440001"}}}' | npm run mcp
```

### List All Memories
```bash
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"list_contexts","arguments":{}}}' | npm run mcp
```

### Read Recent Memories Resource
```bash
echo '{"jsonrpc":"2.0","id":6,"method":"resources/read","params":{"uri":"context://recent"}}' | npm run mcp
```

### Read Memory Types Resource
```bash
echo '{"jsonrpc":"2.0","id":7,"method":"resources/read","params":{"uri":"context://types"}}' | npm run mcp
```

### Add a New Memory
```bash
echo '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"add_context","arguments":{"title":"Test from Console","content":"This is a test memory created from the console","type":"knowledge","tags":["test","console"]}}}' | npm run mcp
```

## Available MCP Tools

- **search_context** - Search through memories using natural language or keywords
- **get_context** - Retrieve a specific memory by ID
- **add_context** - Create a new memory entry
- **update_context** - Modify an existing memory
- **delete_context** - Remove a memory
- **list_contexts** - Browse memories with optional filtering

## Available MCP Resources

- **context://recent** - Recently modified memories
- **context://types** - Memory type statistics and tag counts

## Memory Types

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
├── context-store/     # Your personal memories (auto-created)
└── tests/            # Test files
```

## Configuration

LLMem can be configured using environment variables or a `.env` file in the project root.

### Configuration Options

Create a `.env` file (copy from `.env.example`) and modify as needed:

```bash
# Storage Configuration
LLMEM_STORE_PATH=/path/to/your/memories      # Where memories are stored (default: ~/context-store)
LLMEM_VECTOR_DB_PATH=/custom/vectors.db      # Vector database location (default: {STORE_PATH}/.llmem/vectors.db)
LLMEM_CHROMA_PORT=8765                       # ChromaDB port (default: 8765)

# Model Configuration
LLMEM_EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2  # Embedding model for vector search (default: Xenova/all-MiniLM-L6-v2)

# Remote Repository Configuration  
LLMEM_REMOTE_URL=git@github.com:user/repo.git  # Git remote URL (no default - local only if not set)
LLMEM_AUTH_TYPE=ssh                          # Authentication method: 'ssh' or 'token' (default: ssh if remote set)
LLMEM_AUTH_TOKEN=ghp_your_pat_here          # GitHub Personal Access Token for HTTPS auth (required if auth_type=token)

# Sync Configuration
LLMEM_AUTO_SYNC=true                        # Auto-sync with remote repository (default: true if remote set)
LLMEM_SYNC_INTERVAL=5                       # Background sync interval in minutes (default: 5)

# Behavior Configuration  
LLMEM_AUTO_COMMIT=true                      # Auto-commit changes to git (default: true)
LLMEM_AUTO_INDEX=true                       # Auto-index files for vector search (default: true)
```

### Configuration Details

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LLMEM_STORE_PATH` | string | `~/context-store` | Directory where memories are stored |
| `LLMEM_VECTOR_DB_PATH` | string | `{STORE_PATH}/.llmem/vectors.db` | Path to vector database file |
| `LLMEM_CHROMA_PORT` | number | `8765` | Port for ChromaDB server |
| `LLMEM_EMBEDDING_MODEL` | string | `Xenova/all-MiniLM-L6-v2` | HuggingFace model for embeddings |
| `LLMEM_REMOTE_URL` | string | none | Git repository URL for syncing |
| `LLMEM_AUTH_TYPE` | `ssh\|token` | `ssh` | Authentication method for remote repo |
| `LLMEM_AUTH_TOKEN` | string | none | Personal access token for HTTPS auth |
| `LLMEM_AUTO_SYNC` | boolean | `true` | Enable automatic sync with remote |
| `LLMEM_SYNC_INTERVAL` | number | `5` | Minutes between background syncs |
| `LLMEM_AUTO_COMMIT` | boolean | `true` | Auto-commit changes to git |
| `LLMEM_AUTO_INDEX` | boolean | `true` | Auto-index files for search |

### Remote Repository Setup

LLMem supports syncing your memories with a Git repository:

1. **First-time setup**: When you set `LLMEM_REMOTE_URL`, your local memories will be completely replaced with the remote repository content.

2. **Automatic sync**: All memory operations (create, update, delete) automatically push to the remote repository.

3. **Background sync**: Automatically pulls remote changes every N minutes (configurable).

4. **Conflict resolution**: Automatically resolves conflicts by preferring the remote version while backing up local changes to `.llmem/conflicts/`.

**SSH Authentication** (recommended):
```bash
LLMEM_REMOTE_URL=git@github.com:username/memories.git
LLMEM_AUTH_TYPE=ssh
```

**HTTPS with Personal Access Token**:
```bash
LLMEM_REMOTE_URL=https://github.com/username/memories.git
LLMEM_AUTH_TYPE=token
LLMEM_AUTH_TOKEN=ghp_your_personal_access_token
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

### Memory Store Issues
- The store is created at `~/context-store/` by default
- You can change this in `src/utils/config.ts`
- Make sure you have write permissions in the parent directory

## Features

### ✅ Implemented
- 🔮 **Vector search with semantic similarity** - Using ChromaDB and HuggingFace embeddings
- 👁️ **File watcher for auto-indexing** - Automatically indexes external file changes  
- ☁️ **Git remote sync** - Automatic sync with GitHub/GitLab repositories
- 🔄 **Background sync** - Configurable periodic sync with conflict resolution
- 🎯 **Memory-focused MCP tools** - Optimized for natural language memory queries

### 🚧 Future Features
- 💻 CLI for direct memory management
- 🔐 Encryption for sensitive memories
- 📊 Memory analytics and insights
- 🔗 Cross-memory linking and relationships
- 📱 Mobile companion app

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.