import { LLMemMCPServer } from './mcp/server.js';

async function main() {
  // Check for test mode flag
  const isTestMode = process.argv.includes('--test');
  
  const server = new LLMemMCPServer();
  
  try {
    await server.initialize();
    
    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    if (isTestMode) {
      console.error('🧪 Test mode enabled - server will exit after first command');
      await server.startTestMode();
    } else {
      await server.start();
    }
  } catch (error) {
    console.error('Failed to start LLMem MCP server:', error);
    process.exit(1);
  }
}

main();