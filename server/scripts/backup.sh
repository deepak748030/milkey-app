#!/bin/bash
# Milkey - MongoDB Backup via mongodump (Alternative Method)
# ============================================================
# Ye script mongodump CLI tool se backup karta hai (BSON format)
# Best for: Production Atlas backup, jab aapke system pe mongodump installed ho
#
# Install mongodump:
#   macOS: brew install mongodb-database-tools
#   Ubuntu: sudo apt install mongodb-database-tools
#   Windows: https://www.mongodb.com/try/download/database-tools
#
# Usage:
#   chmod +x server/scripts/backup.sh
#   ./server/scripts/backup.sh
#   MONGODB_URI="mongodb+srv://..." ./server/scripts/backup.sh
#   ./server/scripts/backup.sh --gzip --out ./my-backups

set -e

# Load .env if exists
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$SERVER_DIR")"

if [ -f "$SERVER_DIR/.env" ]; then
    export $(grep -v '^#' "$SERVER_DIR/.env" | xargs -d '\n' 2>/dev/null || export $(cat "$SERVER_DIR/.env" | grep -v '^#' | xargs))
fi
if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs -d '\n' 2>/dev/null || true)
fi

# Parse args
OUT_DIR="$ROOT_DIR/backups"
USE_GZIP=""
URI="$MONGODB_URI"

while [[ $# -gt 0 ]]; do
    case $1 in
        --out) OUT_DIR="$2"; shift 2;;
        --uri) URI="$2"; shift 2;;
        --gzip|--gz) USE_GZIP="--gzip"; shift;;
        *) echo "Unknown option: $1"; exit 1;;
    esac
done

if [ -z "$URI" ]; then
    echo "❌ MONGODB_URI nahi mila!"
    echo "   .env me set karo ya: MONGODB_URI=\"...\" ./server/scripts/backup.sh"
    exit 1
fi

# Check mongodump
if ! command -v mongodump &> /dev/null; then
    echo "❌ mongodump nahi mila. Install karo:"
    echo "   macOS: brew install mongodb-database-tools"
    echo "   Ubuntu: sudo apt install mongodb-database-tools"
    echo "   Ya Node wali script use karo: node server/scripts/backup.js"
    exit 1
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_PATH="$OUT_DIR/mongodump-$TIMESTAMP"

mkdir -p "$BACKUP_PATH"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   🥛 Milkey - mongodump Backup                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "📂 Output: $BACKUP_PATH"
echo "🗜️  Gzip: ${USE_GZIP:-OFF}"
echo ""

# Mask URI for display
MASKED_URI=$(echo "$URI" | sed -E 's|://[^:]+:[^@]+@|://***:***@|')
echo "🔗 URI: $MASKED_URI"
echo "⏳ Dumping..."

mongodump --uri="$URI" --out="$BACKUP_PATH" $USE_GZIP --verbose 2>&1 | head -n 100

echo ""
echo "✅ mongodump complete! Location: $BACKUP_PATH"
echo ""
echo "Restore ke liye:"
echo "  mongorestore --uri=\"\$MONGODB_URI\" --gzip \"$BACKUP_PATH\"   (agar --gzip use kiya tha)"
echo "  mongorestore --uri=\"\$MONGODB_URI\" \"$BACKUP_PATH\""
echo ""
echo "Ya Node wali restore script:"
echo "  node server/scripts/restore.js --in \"$BACKUP_PATH/<dbName>\""
