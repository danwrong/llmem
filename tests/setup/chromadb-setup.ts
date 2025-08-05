import { spawn, ChildProcess } from 'child_process';
import { setTimeout } from 'timers/promises';

export class ChromaDBTestServer {
  private process: ChildProcess | null = null;
  private port: number;

  constructor(port: number = 8766) {
    this.port = port;
  }

  async start(): Promise<void> {
    if (this.process) {
      return; // Already running
    }

    // Try to start ChromaDB in a subprocess
    console.log(`Starting ChromaDB test server on port ${this.port}...`);
    
    this.process = spawn('npx', ['chromadb', 'run', '--host', 'localhost', '--port', this.port.toString(), '--path', './test-chromadb'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });

    if (!this.process) {
      throw new Error('Failed to start ChromaDB process');
    }

    // Handle process errors
    this.process.on('error', (error) => {
      console.error('ChromaDB process error:', error);
    });

    this.process.stdout?.on('data', (data) => {
      console.log('ChromaDB stdout:', data.toString());
    });

    this.process.stderr?.on('data', (data) => {
      console.error('ChromaDB stderr:', data.toString());
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

  private async waitForReady(maxAttempts: number = 15): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Try ChromaDB v2 endpoints
        const response = await fetch(`http://localhost:${this.port}/api/v2/heartbeat`);
        if (response.ok) {
          console.log('ChromaDB test server is ready (v2 heartbeat)');
          return;
        }
      } catch (error) {
        // ChromaDB not ready yet, wait and retry
        console.log(`Attempt ${i + 1}/${maxAttempts}: ChromaDB not ready yet...`);
      }
      
      await setTimeout(2000); // Wait 2 seconds before next attempt
    }
    
    throw new Error(`ChromaDB failed to start after ${maxAttempts * 2} seconds`);
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

// Global test server instance
let globalTestServer: ChromaDBTestServer | null = null;

export async function setupChromaDBForTests(): Promise<void> {
  // This is only called by integration tests
  console.log('Setting up real ChromaDB for integration tests');
  
  if (!globalTestServer) {
    globalTestServer = new ChromaDBTestServer(8766);
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

