#!/bin/bash

# Tokamak DKG Server - Health Check Script
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_ROOT/data/fserver.pid"

# Default health check URL
HEALTH_URL="${DKG_HEALTH_URL:-http://127.0.0.1:9002/health}"
WEBSOCKET_URL="${DKG_WEBSOCKET_URL:-ws://127.0.0.1:9000/ws}"

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

log_status() {
    echo -e "${BLUE}[STATUS]${NC} $1"
}

# Function to check if process is running
check_process() {
    if [[ -f "$PID_FILE" ]]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "✅ Process running (PID: $PID)"
            return 0
        else
            echo "❌ Process not found (stale PID file)"
            return 1
        fi
    else
        echo "❌ No PID file found"
        return 1
    fi
}

# Function to check HTTP health endpoint
check_http_health() {
    local response
    local status_code
    
    if command -v curl &> /dev/null; then
        response=$(curl -s -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
        status_code="${response: -3}"
        response="${response%???}"
        
        if [[ "$status_code" == "200" ]]; then
            echo "✅ HTTP health check passed"
            if command -v jq &> /dev/null && [[ -n "$response" ]]; then
                echo "$response" | jq '.'
            else
                echo "$response"
            fi
            return 0
        else
            echo "❌ HTTP health check failed (status: $status_code)"
            return 1
        fi
    else
        echo "⚠️  curl not available, skipping HTTP health check"
        return 2
    fi
}

# Function to check WebSocket connectivity
check_websocket() {
    if command -v wscat &> /dev/null; then
        # Test WebSocket connection with a simple ping
        timeout 5s wscat -c "$WEBSOCKET_URL" -x '{"type":"ping"}' > /dev/null 2>&1
        if [[ $? -eq 0 ]]; then
            echo "✅ WebSocket connectivity check passed"
            return 0
        else
            echo "❌ WebSocket connectivity check failed"
            return 1
        fi
    elif command -v curl &> /dev/null; then
        # Try WebSocket upgrade with curl
        response=$(curl -s -I -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" "${WEBSOCKET_URL/ws/http}" 2>/dev/null | head -n1)
        if [[ "$response" =~ "101 Switching Protocols" ]]; then
            echo "✅ WebSocket upgrade check passed"
            return 0
        else
            echo "❌ WebSocket upgrade check failed"
            return 1
        fi
    else
        echo "⚠️  wscat/curl not available, skipping WebSocket check"
        return 2
    fi
}

# Function to show server metrics
show_metrics() {
    local metrics_url="${DKG_METRICS_URL:-http://127.0.0.1:9001/metrics}"
    
    if command -v curl &> /dev/null; then
        local metrics
        metrics=$(curl -s "$metrics_url" 2>/dev/null || echo "")
        
        if [[ -n "$metrics" ]]; then
            echo "📊 Server Metrics:"
            echo "$metrics" | grep -E "^(dkg_|up |process_)" | head -10
        else
            echo "⚠️  Unable to fetch metrics"
        fi
    else
        echo "⚠️  curl not available, skipping metrics check"
    fi
}

# Function to show recent logs
show_recent_logs() {
    local log_file="$PROJECT_ROOT/logs/fserver.log"
    
    if [[ -f "$log_file" ]]; then
        echo "📋 Recent Logs (last 10 lines):"
        tail -n 10 "$log_file"
    else
        echo "⚠️  Log file not found: $log_file"
    fi
}

# Main health check
main() {
    log_info "Tokamak DKG Server Health Check"
    echo "=================================="
    echo ""
    
    local overall_status=0
    
    # Check process
    log_status "Process Status:"
    if ! check_process; then
        overall_status=1
    fi
    echo ""
    
    # Check HTTP health
    log_status "HTTP Health Check:"
    local http_status
    check_http_health
    http_status=$?
    if [[ $http_status -eq 1 ]]; then
        overall_status=1
    fi
    echo ""
    
    # Check WebSocket
    log_status "WebSocket Connectivity:"
    local ws_status
    check_websocket
    ws_status=$?
    if [[ $ws_status -eq 1 ]]; then
        overall_status=1
    fi
    echo ""
    
    # Show metrics
    log_status "Server Metrics:"
    show_metrics
    echo ""
    
    # Show recent logs
    log_status "Recent Activity:"
    show_recent_logs
    echo ""
    
    # Overall status
    echo "=================================="
    if [[ $overall_status -eq 0 ]]; then
        log_info "🎉 Overall Status: HEALTHY"
        log_info "WebSocket Endpoint: $WEBSOCKET_URL"
        log_info "Health Endpoint: $HEALTH_URL"
    else
        log_error "💥 Overall Status: UNHEALTHY"
        log_error "Check the issues above and server logs for more details"
    fi
    
    exit $overall_status
}

# Handle command line arguments
case "${1:-check}" in
    "check" | "status")
        main
        ;;
    "process")
        check_process
        ;;
    "http")
        check_http_health
        ;;
    "websocket" | "ws")
        check_websocket
        ;;
    "metrics")
        show_metrics
        ;;
    "logs")
        show_recent_logs
        ;;
    "help" | "-h" | "--help")
        echo "Usage: $0 [check|process|http|websocket|metrics|logs|help]"
        echo ""
        echo "Commands:"
        echo "  check      - Full health check (default)"
        echo "  process    - Check if server process is running"
        echo "  http       - Check HTTP health endpoint"
        echo "  websocket  - Check WebSocket connectivity"
        echo "  metrics    - Show server metrics"
        echo "  logs       - Show recent logs"
        echo "  help       - Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  DKG_HEALTH_URL    - Health check URL (default: http://127.0.0.1:9002/health)"
        echo "  DKG_WEBSOCKET_URL - WebSocket URL (default: ws://127.0.0.1:9000/ws)"
        echo "  DKG_METRICS_URL   - Metrics URL (default: http://127.0.0.1:9001/metrics)"
        ;;
    *)
        log_error "Unknown command: $1"
        log_info "Use '$0 help' for usage information"
        exit 1
        ;;
esac