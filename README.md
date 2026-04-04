# BagsFuel — The Autonomous Creator Growth Engine

> A Claude Skill that turns idle creator fees into a self-sustaining token growth flywheel. Claim fees, buyback your token, reward holders — all onchain, all automated.

Built for [The Bags Hackathon](https://bags.fm/hackathon) | Tracks: Claude Skills, Bags API, Fee Sharing

---

## The Problem

Bags.fm creators earn 1% royalties on every trade forever — but most fees sit unclaimed. Meanwhile, post-launch token growth requires constant manual effort: buying back supply, rewarding loyal holders, generating real volume. There are zero tools that automate this.

## The Solution

BagsFuel is a Claude Skill that runs the **Creator Growth Flywheel** in a single command:

```
Creator Fees (1% royalties)
        |
        v
   +-----------+
   |   CLAIM   | <- Auto-claim all unclaimed SOL fees
   +-----+-----+
         |
   +-----v-----+
   |  BUYBACK   | <- Swap 30% into your token (real volume!)
   +-----+-----+
         |
   +-----v-----+
   |  REWARDS   | <- Distribute 20% SOL to top 25 holders
   +-----+-----+
         |
         v
  Token price up -> More trading -> More fees -> Loop
```

Every action is a **real onchain Solana transaction** — fee claims, token swaps via Bags DEX, and SOL transfers to holder wallets.

## Quick Start

### 1. Install

```bash
git clone https://github.com/minalkharat-cmd/bagsfuel.git
cd bagsfuel
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable | Description |
|----------|-------------|
| `BAGS_API_KEY` | Get from [dev.bags.fm](https://dev.bags.fm) |
| `PRIVATE_KEY` | Your creator wallet private key (base58) |
| `TOKEN_MINT` | Your token's mint address on Bags |
| `SOLANA_RPC_URL` | Helius, Quicknode, or public RPC |

### 3. Run

```bash
# Full growth cycle: claim -> buyback -> reward -> report
npx ts-node src/engine.ts

# Just view analytics
npx ts-node src/engine.ts --report

# Just claim fees
npx ts-node src/engine.ts --claim
```

## How It Works

### Auto Fee Claiming (`src/claim-fees.ts`)
Scans all claimable positions via `sdk.fee.getAllClaimablePositions()`, then executes claim transactions for any position above the minimum threshold (default: 0.1 SOL).

### Token Buyback (`src/buyback.ts`)
Takes a configurable percentage of claimed SOL (default: 30%) and executes a market buy of your token through the Bags DEX. Includes price impact protection (skips if >5%).

### Holder Rewards (`src/holder-rewards.ts`)
Distributes a percentage of claimed SOL (default: 20%) proportionally to your top holders. Queries the Solana token program for the largest accounts and batch-sends SOL transfers.

### Analytics (`src/analytics.ts`)
Generates a real-time report: wallet balance, holder count, claimable positions, and token health metrics.

### Engine (`src/engine.ts`)
Orchestrates the full cycle and produces a summary of all onchain transactions executed.

## Configuration

All tunable via `.env`:

```
BUYBACK_PERCENT=30        # % of claimed SOL used for buybacks
REWARDS_PERCENT=20        # % of claimed SOL distributed to holders
TOP_HOLDERS_COUNT=25      # Number of top holders to reward
MIN_CLAIM_THRESHOLD=100000000  # Min lamports to trigger claim (0.1 SOL)
SLIPPAGE_BPS=300          # Slippage tolerance (3%)
```

The remaining 50% stays in the creator wallet as retained earnings.

## As a Claude Skill

BagsFuel is designed to be used as a Claude Skill. Drop the `SKILL.md` into your Claude skills directory and use natural language:

- *"Run a growth cycle for my token"*
- *"How much in unclaimed fees do I have?"*
- *"Buyback my token with 0.5 SOL"*
- *"Show me my token analytics"*

## Tech Stack

- **Bags SDK** (`@bagsfm/bags-sdk`) — Fee claiming, DEX quotes & swaps
- **Solana Web3.js** — Transaction signing, token account queries
- **TypeScript** — Full type safety across all modules
- **Claude Skills** — Natural language interface via SKILL.md

## Hackathon Tracks

| Track | How BagsFuel Fits |
|-------|-------------------|
| **Claude Skills** | Full SKILL.md with natural language commands |
| **Bags API** | Deep SDK integration: fees, trading, analytics |
| **Fee Sharing** | Core mechanic: auto-claim + redistribute fees |

## License

MIT

---

Built with the [Bags SDK](https://dev.bags.fm) and [Claude](https://claude.ai)
