#!/bin/bash

# Tokamak DKG Server - Production Stop Script
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_ROOT/data/fserver.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PID file exists
if [[ ! -f "$PID_FILE" ]]; then
    log_warn "No PID file found at: $PID_FILE"
    log_info "Server may not be running or was started manually"
    exit 0
fi

# Read PID
PID=$(cat "$PID_FILE")

# Check if process is running
if ! kill -0 "$PID" 2>/dev/null; then
    log_warn "Process with PID $PID is not running"
    rm -f "$PID_FILE"
    exit 0
fi

log_info "Stopping Tokamak DKG Server (PID: $PID)..."

# Try graceful shutdown first
log_info "Attempting graceful shutdown..."
kill -TERM "$PID" 2>/dev/null || true

# Wait up to 30 seconds for graceful shutdown
TIMEOUT=30
COUNTER=0

while kill -0 "$PID" 2>/dev/null && [[ $COUNTER -lt $TIMEOUT ]]; do
    sleep 1
    COUNTER=$((COUNTER + 1))
    if [[ $((COUNTER % 5)) -eq 0 ]]; then
        log_info "Waiting for graceful shutdown... (${COUNTER}/${TIMEOUT}s)"
    fi
done

# Check if process is still running
if kill -0 "$PID" 2>/dev/null; then
    log_warn "Graceful shutdown timed out, forcing termination..."
    kill -KILL "$PID" 2>/dev/null || true
    sleep 2
    
    # Final check
    if kill -0 "$PID" 2>/dev/null; then
        log_error "Failed to stop process with PID: $PID"
        exit 1
    else
        log_info "Process forcefully terminated"
    fi
else
    log_info "Server stopped gracefully"
fi

# Clean up PID file
rm -f "$PID_FILE"

log_info "Tokamak DKG Server stopped successfully"