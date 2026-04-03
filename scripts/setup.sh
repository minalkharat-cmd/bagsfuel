#!/bin/bash
# BagsFuel — Setup Script
# Installs dependencies and prepares the project

set -e

BAGSFUEL_DIR="${BAGSFUEL_DIR:-$HOME/.bagsfuel}"

echo "=== BagsFuel Setup ==="
echo "Installing to: $BAGSFUEL_DIR"

# Clone or update
if [ -d "$BAGSFUEL_DIR" ]; then
  echo "BagsFuel directory exists. Updating..."
  cd "$BAGSFUEL_DIR"
else
  echo "Creating BagsFuel directory..."
  mkdir -p "$BAGSFUEL_DIR"
  cd "$BAGSFUEL_DIR"
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is required but not installed."
  echo "Install from: https://nodejs.org"
  exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
  echo "ERROR: npm is required but not installed."
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install @bagsfm/bags-sdk @solana/web3.js @solana/spl-token bs58 dotenv typescript ts-node @types/node 2>/dev/null

# Check for .env
if [ ! -f "$BAGSFUEL_DIR/.env" ]; then
  echo ""
  echo "WARNING: No .env file found."
  echo "Copy .env.example to .env and configure your settings:"
  echo "  cp .env.example .env"
  echo "  # Then edit .env with your API key, private key, and token mint"
fi

echo ""
echo "=== Setup Complete ==="
echo "Run 'npx ts-node src/engine.ts' to start a growth cycle"
echo "Run 'npx ts-node src/engine.ts --report' for analytics"