import { setupChromaDBForTests, teardownChromaDBForTests } from './chromadb-setup.js';

export async function setup() {
  // Start ChromaDB if needed
  await setupChromaDBForTests();
}

export async function teardown() {
  // Stop ChromaDB if running
  await teardownChromaDBForTests();
}