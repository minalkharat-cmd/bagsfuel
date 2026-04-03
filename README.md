# BagsFuel - The Autonomous Creator Growth Engine

> A Claude Skill that turns idle creator fees into a self-sustaining token growth flywheel.

Built for The Bags Hackathon | Tracks: Claude Skills, Bags API, Fee Sharing

## Quick Start

```
git clone https://github.com/minalkharat-cmd/bagsfuel.git
cd bagsfuel && npm install
cp .env.example .env
npx ts-node src/engine.ts
```

## Architecture

- src/claim-fees.ts - Auto-claim creator royalties via Bags SDK
- src/buyback.ts - Execute token buybacks through Bags DEX
- src/holder-rewards.ts - Distribute SOL to top holders
- src/analytics.ts - Real-time token health reporting
- src/engine.ts - Orchestrate full growth cycles
- SKILL.md - Claude Skill for natural language commands

## License

MIT
