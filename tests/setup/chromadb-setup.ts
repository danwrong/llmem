import { spawn, ChildProcess } from 'child_process';
import { setTimeout } from 'timers/promises';

export class ChromaDBTestServer {
  private process: ChildProcess | null = null;
  private port: number;

  constructor(port: number = 8765) {
    this.port = port;
  }

  async start(): Promise<void> {
    if (this.process) {
      return; // Already running
    }

    // Try to start ChromaDB in a subprocess
    console.log(`Starting ChromaDB test server on port ${this.port}...`);
    
    this.process = spawn('python', ['-m', 'chromadb.cli', 'run', '--host', 'localhost', '--port', this.port.toString(), '--path', './test-chromadb'], {
      stdio: 'pipe'
    });

    if (!this.process) {
      throw new Error('Failed to start ChromaDB process');
    }

    // Handle process errors
    this.process.on('error', (error) => {
      console.error('ChromaDB process error:', error);
    });

    this.process.on('exit', (code) => {
      if (code !== 0) {
        console.warn(`ChromaDB process exited with code ${code}`);
      }
      this.process = null;
    });

    // Wait for ChromaDB to start
    await this.waitForReady();
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      console.log('Stopping ChromaDB test server...');
      this.process.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await setTimeout(2000);
      
      // Force kill if still running
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }
    this.process = null;
  }

  private async waitForReady(maxAttempts: number = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.port}/api/v1/heartbeat`);
        if (response.ok) {
          console.log('ChromaDB test server is ready');
          return;
        }
      } catch (error) {
        // ChromaDB not ready yet
      }
      
      await setTimeout(1000); // Wait 1 second before next attempt
    }
    
    throw new Error(`ChromaDB failed to start after ${maxAttempts} seconds`);
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

// Global test server instance
let globalTestServer: ChromaDBTestServer | null = null;

export async function setupChromaDBForTests(): Promise<void> {
  // Check if we should use real ChromaDB or mocks
  const useRealChromaDB = process.env.LLMEM_TEST_REAL_CHROMADB === 'true';
  
  if (!useRealChromaDB) {
    console.log('Using ChromaDB mocks for unit tests');
    return;
  }

  console.log('Setting up real ChromaDB for integration tests');
  
  if (!globalTestServer) {
    globalTestServer = new ChromaDBTestServer(8765);
  }

  if (!globalTestServer.isRunning()) {
    try {
      await globalTestServer.start();
    } catch (error) {
      console.error('❌ Failed to start ChromaDB for integration tests:', error);
      console.error('💡 Integration tests require ChromaDB. Run: npm run test:unit for unit tests only');
      throw new Error(`ChromaDB integration test setup failed: ${error.message}`);
    }
  }
}

export async function teardownChromaDBForTests(): Promise<void> {
  if (globalTestServer) {
    await globalTestServer.stop();
    globalTestServer = null;
  }
}

export function isUsingRealChromaDB(): boolean {
  return process.env.LLMEM_TEST_REAL_CHROMADB === 'true' && globalTestServer?.isRunning() === true;
}