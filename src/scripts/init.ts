import { ContextStore } from '../storage/context-store.js';
import { getConfig } from '../utils/config.js';

async function initializeContextStore() {
  console.log('Initializing LLMem context store...');
  
  const config = getConfig();
  console.log(`Store path: ${config.storePath}`);
  
  const store = new ContextStore();
  await store.initialize();
  
  // Create a welcome context
  await store.create(
    'Welcome to LLMem',
    `# Welcome to LLMem

This is your personal context store. You can use it to store:

- Personal information and preferences
- Project-specific context
- Knowledge and reference material
- Conversation history

## Getting Started

1. Contexts are organized by type in the \`contexts/\` directory
2. Each context is a markdown file with YAML frontmatter
3. Use the MCP server to allow LLMs to access your contexts
4. All changes are tracked in git for version history

Happy context storing!`,
    'knowledge',
    {
      tags: ['meta', 'help'],
    }
  );
  
  console.log('✅ Context store initialized successfully!');
  console.log(`📁 Location: ${config.storePath}`);
  console.log('🚀 You can now start the MCP server with: npm start');
}

initializeContextStore().catch(console.error);