#!/bin/bash
# BagsFuel — Generate analytics report

set -e

BAGSFUEL_DIR="${BAGSFUEL_DIR:-$HOME/.bagsfuel}"
cd "$BAGSFUEL_DIR"

if [ ! -f ".env" ]; then
  echo "ERROR: No .env file found. Run setup first and configure .env"
  exit 1
fi

npx ts-node src/analytics.ts