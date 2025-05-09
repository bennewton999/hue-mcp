#!/usr/bin/env node

import { config } from 'dotenv';
import { startMCPServer } from './server.js';

// Load environment variables from .env file
config();

// Main entry point
async function main() {
  try {
    const port = process.env.MCP_PORT
      ? parseInt(process.env.MCP_PORT, 10)
      : 3000;
    await startMCPServer(port);
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
