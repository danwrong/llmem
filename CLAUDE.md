# LLMem - Personal Context Store

A local-first personal memory system that provides LLMs with searchable access to your personal context through an MCP server.

## Overview

LLMem stores personal information, project contexts, and knowledge as markdown files in a git repository, with vector search capabilities for semantic retrieval. The system is designed to be portable, private, and transparent.

## Architecture

### Storage Layer
- **Format**: Markdown files with YAML frontmatter
- **Version Control**: Git for history and potential sync
- **Location**: `~/context-store/` (configurable)
- **Structure**:
  ```
  context-store/
  ├── contexts/
  │   ├── daily/          # Auto-generated daily notes
  │   ├── people/         # Contacts, relationships
  │   ├── projects/       # Project-specific context
  │   └── knowledge/      # Reference material
  └── .llmem/
      ├── vectors.db      # ChromaDB embeddings
      └── cache/          # Temporary files
  ```

### Markdown Schema
```yaml
---
id: uuid-here
title: "Context Title"
type: personal|project|knowledge|conversation
tags: [tag1, tag2]
created: 2025-01-15T10:00:00Z
updated: 2025-01-15T10:00:00Z
expires: null  # Optional expiration
relations: [related-uuid-1, related-uuid-2]
---

# Content goes here
Regular markdown content...
```

### Search Capabilities ✅ FULLY IMPLEMENTED

#### 1. Hybrid Search System
- **Text Search**: Exact keyword matching with word-level scoring
- **Vector Search**: Semantic similarity using ChromaDB + local embeddings
- **Combined Scoring**: Weighted combination of text + semantic matches
- **Graceful Fallback**: Falls back to enhanced text search if vector search fails

#### 2. Vector Search Implementation
- **Database**: ChromaDB v3 with local server
- **Embeddings**: Xenova/all-MiniLM-L6-v2 (384 dimensions)  
- **Configuration**: In-memory ChromaDB server on localhost:8000
- **Auto-indexing**: File watcher rebuilds index when contexts change
- **Persistence**: Vector index survives server restarts

#### 3. Search Quality Improvements
**Before Vector Search:**
- Only exact substring matching
- "coffee" wouldn't find "brewing tips"
- No semantic understanding

**After Vector Search:**
- Semantic understanding of queries
- "coffee brewing techniques" finds coffee preferences with brewing methods
- "software development best practices" finds TypeScript guidelines
- Contextual relevance scoring

## MCP Interface

### Available Tools

1. **search_context**
   - Natural language search across all contexts
   - Parameters: query, category (optional), limit, time_range

2. **get_context**
   - Retrieve specific context by ID
   - Parameters: id

3. **add_context**
   - Create new context entry
   - Parameters: title, content, type, tags

4. **update_context**
   - Modify existing context
   - Parameters: id, updates

5. **delete_context**
   - Remove context entry
   - Parameters: id

6. **list_contexts**
   - Browse available contexts with filtering
   - Parameters: type (optional), tags (optional), limit

### Resources
- `recent_contexts`: Recently accessed/modified items
- `context_types`: Available context types and their counts

## Tech Stack

- **Language**: TypeScript/Node.js
- **MCP SDK**: @modelcontextprotocol/sdk
- **Git**: simple-git
- **Markdown**: gray-matter, unified/remark
- **Vector DB**: ChromaDB
- **Embeddings**: @xenova/transformers (local)
- **File Watching**: chokidar

## Development Roadmap

### Phase 1: Core Storage ✅ COMPLETED
- [x] Architecture design and planning
- [x] Simplified data model (removed privacy/categories)
- [x] Git storage implementation with simple-git
- [x] Markdown parser with frontmatter support
- [x] CRUD operations for context files
- [x] Comprehensive test suite (43 tests passing)
- [x] Auto-commit functionality

### Phase 2: MCP Server ✅ COMPLETED
- [x] Basic MCP server with stdio transport
- [x] Tool handlers (search_context, get_context, add_context, etc.)
- [x] Resource providers (recent_contexts, context_types)
- [x] Unit tests for MCP handlers
- [x] End-to-end MCP server tests
- [x] Error handling and validation
- [x] Claude Desktop integration working

### Phase 3: Enhanced Search ✅ COMPLETED
- [x] ChromaDB integration for vector search
- [x] Local embedding generation (@xenova/transformers)
- [x] Hybrid search (text + semantic)
- [x] File watcher for auto-indexing
- [x] Test mode for easier development

### Phase 4: Polish & Advanced Features
- [ ] Performance optimization
- [ ] CLI for direct interaction
- [ ] Context expiration handling
- [ ] Configuration system improvements

## Design Decisions

### Simplified Data Model
- **Removed privacy levels**: Git repository access provides the security boundary
- **Removed separate categories**: Directory structure (`contexts/personal/`, `contexts/projects/`) + tags provide sufficient organization
- **Focus on core functionality**: Simpler model, easier to understand and maintain

### Security & Privacy
- **Repository-level security**: Access to the git repository = access to all contexts
- **Local-first approach**: All data stays on your device by default
- **Future cloud sync**: Optional git remote for backup/mobile access

## Future Considerations

- **Cloud Sync**: Git remote for backup (GitHub private repo)
- **Mobile Access**: Sparse checkout for subset of data
- **Encryption**: Optional git-crypt for sensitive data
- **Collaboration**: Shared contexts via git branches

## Getting Started

```bash
# Clone the repository
git clone [repo-url]
cd llmem

# Install dependencies
npm install

# Initialize context store (creates ~/context-store/)
npm run init

# Start ChromaDB server (required for vector search)
npx chromadb run --path /tmp/chromadb-llmem --port 8000 &

# Start MCP server for Claude Desktop
npm run mcp

# Or start in test mode (exits after one command)
npm run mcp:test
```

## Development & Testing

### Test Mode 🧪
For easier development and testing, use test mode which automatically exits after processing one command:

```bash
# Test tools list
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npm run mcp:test

# Test vector search
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_context","arguments":{"query":"coffee brewing"}}}' | npm run mcp:test

# Test context creation
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"add_context","arguments":{"title":"Test Context","content":"Test content","type":"knowledge","tags":["test"]}}}' | npm run mcp:test
```

### Vector Search Testing
To verify vector search is working properly:

1. **Check ChromaDB server**: `curl -s http://localhost:8000/api/v2/heartbeat`
2. **Test semantic search**: Query "coffee brewing" should find coffee preferences
3. **Test development queries**: "software best practices" should find TypeScript content
4. **Verify hybrid scoring**: Results should be ranked by semantic + text relevance

### Expected Search Behavior
- **"coffee brewing techniques"** → Finds "My Coffee Preferences" (contains brewing methods)
- **"software development best practices"** → Finds "TypeScript Best Practices" first
- **"programming typescript"** → Ranks TypeScript content highest
- **"meeting notes integration"** → Finds MCP/Circleback discussions

### Prerequisites
- **Node.js 18+**
- **ChromaDB server** running on localhost:8000
- **Context files** in ~/context-store/contexts/

## Configuration

Default configuration:
```yaml
store_path: ~/context-store
vector_db: chromadb
embedding_model: Xenova/all-MiniLM-L6-v2
auto_commit: true
auto_index: true  # Enable file watcher for auto-indexing
```

## Technical Architecture Details

### Vector Search Components
```
src/storage/
├── vector-store.ts          # ChromaDB integration + embeddings
├── hybrid-search.ts         # Combines vector + text search
├── file-watcher.ts         # Auto-indexing on file changes
└── context-store.ts        # Main interface (enhanced with vector search)
```

### Search Flow
1. **Query received** via MCP search_context tool
2. **Hybrid search** runs vector + text search in parallel
3. **Vector search** generates query embedding → ChromaDB similarity search
4. **Text search** performs enhanced keyword matching with scoring
5. **Results combined** with weighted scoring (70% semantic, 30% exact match boost)
6. **Ranked results** returned sorted by relevance score

### Embedding Pipeline
1. **Text preprocessing**: Clean + truncate to 512 chars
2. **Local embedding**: Xenova/all-MiniLM-L6-v2 with mean pooling + normalization
3. **384-dimensional vectors** stored in ChromaDB
4. **Cosine similarity** for semantic matching

## Troubleshooting

### ChromaDB Issues
```bash
# Check if ChromaDB server is running
curl -s http://localhost:8000/api/v2/heartbeat

# Start ChromaDB server
npx chromadb run --path /tmp/chromadb-llmem --port 8000 &

# Kill existing ChromaDB processes
pkill -f "chromadb run"
```

### Vector Search Not Working
1. **Check server logs** for ChromaDB connection errors
2. **Verify embedding dimensions** (should be 384)
3. **Rebuild vector index** - delete .chroma directory and restart
4. **Check file watcher** - contexts should auto-index on changes

### Common Issues
- **"Collection expecting embedding with dimension X, got Y"** → Restart ChromaDB with fresh database
- **"ChromaConnectionError: Failed to connect"** → Start ChromaDB server first
- **"VectorStore not initialized"** → Vector search failed, using text fallback (normal)
- **MCP server hanging** → Use `npm run mcp:test` for testing, `npm run mcp` for production

### Performance Notes
- **First run**: Rebuilds vector index (4 contexts = ~2-3 seconds)
- **Subsequent runs**: Loads existing embeddings instantly  
- **Memory usage**: ~100MB for embeddings model + vectors
- **Search latency**: <100ms for hybrid search with small context sets