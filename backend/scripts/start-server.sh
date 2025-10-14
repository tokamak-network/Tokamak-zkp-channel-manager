#!/bin/bash

# Tokamak DKG Server - Production Start Script
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FROST_DKG_DIR="$(dirname "$PROJECT_ROOT")/frost-dkg"

# Default configuration
DKG_SERVER_BIND="${DKG_SERVER_BIND:-0.0.0.0:9000}"
DKG_SERVER_LOG_LEVEL="${DKG_SERVER_LOG_LEVEL:-info}"
DKG_SERVER_DEV_MODE="${DKG_SERVER_DEV_MODE:-false}"
DKG_MAX_CONNECTIONS="${DKG_MAX_CONNECTIONS:-100}"
DKG_SESSION_TIMEOUT="${DKG_SESSION_TIMEOUT:-3600}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Check if frost-dkg directory exists
if [[ ! -d "$FROST_DKG_DIR" ]]; then
    log_error "frost-dkg directory not found at: $FROST_DKG_DIR"
    log_error "Please ensure the frost-dkg submodule is properly initialized."
    exit 1
fi

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    log_error "Cargo not found. Please install Rust: https://rustup.rs/"
    exit 1
fi

# Build the fserver binary if it doesn't exist or is outdated
BINARY_PATH="$FROST_DKG_DIR/target/release/fserver"
if [[ ! -f "$BINARY_PATH" ]] || [[ "$FROST_DKG_DIR/fserver/src/main.rs" -nt "$BINARY_PATH" ]]; then
    log_info "Building fserver binary..."
    cd "$FROST_DKG_DIR"
    cargo build --release -p fserver
    log_info "Build completed successfully"
fi

# Create data and log directories
mkdir -p "$PROJECT_ROOT/data" "$PROJECT_ROOT/logs"

# Check if server is already running
PID_FILE="$PROJECT_ROOT/data/fserver.pid"
if [[ -f "$PID_FILE" ]]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        log_warn "Server is already running with PID: $PID"
        log_info "Use './scripts/stop-server.sh' to stop it first"
        exit 1
    else
        log_warn "Removing stale PID file"
        rm -f "$PID_FILE"
    fi
fi

# Set environment variables
export DKG_SERVER_BIND
export DKG_SERVER_LOG_LEVEL
export DKG_SERVER_DEV_MODE
export DKG_MAX_CONNECTIONS
export DKG_SESSION_TIMEOUT

# Start the server
log_info "Starting Tokamak DKG Server..."
log_info "Configuration:"
log_info "  Bind Address: $DKG_SERVER_BIND"
log_info "  Log Level: $DKG_SERVER_LOG_LEVEL"
log_info "  Dev Mode: $DKG_SERVER_DEV_MODE"
log_info "  Max Connections: $DKG_MAX_CONNECTIONS"
log_info "  Session Timeout: ${DKG_SESSION_TIMEOUT}s"

# Start server in background and capture PID
"$BINARY_PATH" server --bind "$DKG_SERVER_BIND" \
    > "$PROJECT_ROOT/logs/fserver.log" 2>&1 &

SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

# Wait a moment to check if server started successfully
sleep 2

if kill -0 "$SERVER_PID" 2>/dev/null; then
    log_info "Server started successfully with PID: $SERVER_PID"
    log_info "WebSocket endpoint: ws://$DKG_SERVER_BIND/ws"
    log_info "Health check: http://${DKG_SERVER_BIND%:*}:9002/health"
    log_info "Logs: $PROJECT_ROOT/logs/fserver.log"
    log_info ""
    log_info "Use './scripts/stop-server.sh' to stop the server"
    log_info "Use './scripts/health-check.sh' to check server status"
else
    log_error "Failed to start server. Check logs at: $PROJECT_ROOT/logs/fserver.log"
    rm -f "$PID_FILE"
    exit 1
fi