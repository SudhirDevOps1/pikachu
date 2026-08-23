#!/usr/bin/env bash
# Pika AI Assistant — Linux/Mac launcher
set -e

echo "======================================================="
echo "      ⚡ PIKA AI ASSISTANT — LAUNCHER"
echo "======================================================="

echo "[1/4] Checking Python..."
if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] Python 3.10+ required."
  exit 1
fi

echo "[2/4] Installing Python dependencies..."
pip3 install -r requirements.txt --quiet || echo "[warn] some packages failed"

echo "[3/4] Installing frontend dependencies..."
npm install --silent

echo "[4/4] Starting services..."
python3 pc_bridge.py &
BRIDGE_PID=$!
trap "kill $BRIDGE_PID 2>/dev/null" EXIT

echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   ws://localhost:8765"
echo ""
npm run dev
