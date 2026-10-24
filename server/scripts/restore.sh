#!/bin/bash
# Milkey - MongoDB Restore via mongorestore (Alternative Method)
# ===============================================================
# Usage:
#   chmod +x server/scripts/restore.sh
#   ./server/scripts/restore.sh --in ./backups/mongodump-2024-01-01T10-00-00Z/mydb
#   ./server/scripts/restore.sh --in ./backups/mongodump-... --drop --gzip

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$SERVER_DIR")"

if [ -f "$SERVER_DIR/.env" ]; then
    export $(grep -v '^#' "$SERVER_DIR/.env" | xargs -d '\n' 2>/dev/null || export $(cat "$SERVER_DIR/.env" | grep -v '^#' | xargs))
fi
if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs -d '\n' 2>/dev/null || true)
fi

IN_DIR=""
USE_GZIP=""
DROP_FLAG=""
URI="$MONGODB_URI"
DRY_RUN=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --in) IN_DIR="$2"; shift 2;;
        --uri) URI="$2"; shift 2;;
        --gzip|--gz) USE_GZIP="--gzip"; shift;;
        --drop) DROP_FLAG="--drop"; shift;;
        --dry-run) DRY_RUN="1"; shift;;
        *) echo "Unknown option: $1"; exit 1;;
    esac
done

if [ -z "$IN_DIR" ]; then
    echo "❌ --in folder nahi diya!"
    echo "   Usage: ./server/scripts/restore.sh --in ./backups/mongodump-2024-.../mydb"
    echo "   Available:"
    ls -1 "$ROOT_DIR/backups/" 2>/dev/null || echo "   (no backups yet)"
    exit 1
fi

if [ -z "$URI" ]; then
    echo "❌ MONGODB_URI nahi mila!"
    exit 1
fi

if ! command -v mongorestore &> /dev/null; then
    echo "❌ mongorestore nahi mila. Install: brew install mongodb-database-tools"
    echo "   Ya Node script: node server/scripts/restore.js --in \"$IN_DIR\""
    exit 1
fi

MASKED_URI=$(echo "$URI" | sed -E 's|://[^:]+:[^@]+@|://***:***@|')

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   🥛 Milkey - mongorestore                         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "📂 Input: $IN_DIR"
echo "🔗 URI: $MASKED_URI"
if [ -n "$DROP_FLAG" ]; then
    echo "⚠️  Mode: DROP (collection pehle delete hogi!)"
    echo "   5 sec me start... Ctrl+C to cancel"
    sleep 5
else
    echo "🛡️  Mode: Safe (existing update, naye insert)"
fi
echo ""

if [ -n "$DRY_RUN" ]; then
    echo "🧪 DRY RUN — mongorestore --dryRun"
    mongorestore --uri="$URI" --dir="$IN_DIR" $USE_GZIP $DROP_FLAG --dryRun --verbose 2>&1 | head -n 50
    echo ""
    echo "🧪 Dry run complete — koi change nahi hua"
    exit 0
fi

echo "⏳ Restoring..."
mongorestore --uri="$URI" --dir="$IN_DIR" $USE_GZIP $DROP_FLAG --verbose 2>&1 | head -n 100

echo ""
echo "✅ Restore complete!"
echo ""
