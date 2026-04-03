#!/bin/bash
# BagsFuel — Run one growth cycle
# Claims fees, executes buyback, distributes holder rewards

set -e

BAGSFUEL_DIR="${BAGSFUEL_DIR:-$HOME/.bagsfuel}"
cd "$BAGSFUEL_DIR"

if [ ! -f ".env" ]; then
  echo "ERROR: No .env file found. Run setup first and configure .env"
  exit 1
fi

echo "Starting BagsFuel growth cycle..."
npx ts-node src/engine.ts "$@"