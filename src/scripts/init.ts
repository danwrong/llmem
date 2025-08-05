import { ContextStore } from '../storage/context-store.js';
import { getConfig } from '../utils/config.js';

async function initializeMemoryStore() {
  console.log('Initializing LLMem memory store...');
  
  const config = getConfig();
  console.log(`Store path: ${config.storePath}`);
  
  const store = new ContextStore();
  await store.initialize();
  
  // Create a welcome memory
  await store.create(
    'Welcome to LLMem',
    `# Welcome to LLMem

This is your personal memory store. You can use it to store:

- Personal information and preferences
- Project-specific context
- Knowledge and reference material
- Conversation history

## Getting Started

1. Memories are organized by type in the \`contexts/\` directory
2. Each memory is a markdown file with YAML frontmatter
3. Use the MCP server to allow LLMs to access your memories
4. All changes are tracked in git for version history

Happy memory storing!`,
    'knowledge',
    {
      tags: ['meta', 'help'],
    }
  );
  
  console.log('✅ Memory store initialized successfully!');
  console.log(`📁 Location: ${config.storePath}`);
  console.log('🚀 You can now start the MCP server with: npm start');
}

initializeMemoryStore().catch(console.error);