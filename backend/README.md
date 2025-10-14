# Tokamak DKG Server - Production Deployment

This directory contains production deployment configurations for the Tokamak FROST DKG server (`fserver` from the `frost-dkg` repository).

## Quick Start

### Option 1: Docker (Recommended for Production)

```bash
# Build and run with Docker
docker build -t tokamak-dkg-server .
docker run -p 9000:9000 tokamak-dkg-server

# Or use docker-compose
docker-compose up -d
```

### Option 2: Direct Binary (Development)

```bash
# Build the server from frost-dkg
cd ../frost-dkg
cargo build --release -p fserver

# Run with custom configuration
./target/release/fserver server --bind 0.0.0.0:9000
```

### Option 3: Using the Scripts

```bash
# Start server in production mode
./scripts/start-server.sh

# Stop server gracefully  
./scripts/stop-server.sh

# Check server status
./scripts/health-check.sh
```

## Quick Server Management Commands

```bash
# Check server status
ps aux | grep fserver
curl -f http://localhost:9000/health 2>/dev/null && echo "Server OK" || echo "Server Down"

# Restart server (if authentication issues or crashes)
pkill -f fserver
cd frost-dkg && ./target/release/fserver server --bind 0.0.0.0:9000

# Background server with logs
cd frost-dkg && nohup ./target/release/fserver server --bind 0.0.0.0:9000 > server.log 2>&1 &

# Stop server gracefully
curl -X POST http://localhost:9000/close
```

## Production Configuration

### Environment Variables

```bash
# Server Configuration
DKG_SERVER_BIND=0.0.0.0:9000          # Server bind address
DKG_SERVER_LOG_LEVEL=info             # Log level (error, warn, info, debug, trace)
DKG_SERVER_DEV_MODE=false             # Enable development mode

# Security Configuration  
DKG_TLS_CERT_PATH=/etc/ssl/server.crt # TLS certificate (if using HTTPS)
DKG_TLS_KEY_PATH=/etc/ssl/server.key  # TLS private key
DKG_ENABLE_TLS=false                  # Enable TLS/WSS
DKG_MAX_CONNECTIONS=100               # Max concurrent connections
DKG_SESSION_TIMEOUT=3600              # Session timeout in seconds

# Operational
DKG_METRICS_PORT=9001                 # Prometheus metrics port
DKG_HEALTH_CHECK_PORT=9002            # Health check port
```

### Docker Configuration

The `Dockerfile` builds the `fserver` binary and runs it in a secure container:

- Uses multi-stage build for smaller image size
- Runs as non-root user for security
- Exposes ports 9000 (WebSocket), 9001 (metrics), 9002 (health)
- Includes health check endpoint

### Kubernetes Deployment

For Kubernetes deployment, see `k8s/` directory:

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=tokamak-dkg-server
kubectl logs -l app=tokamak-dkg-server -f
```

## Server Features

### WebSocket Endpoints

- **`/ws`** - Main DKG WebSocket endpoint
- **`/health`** - Health check endpoint (HTTP GET)
- **`/metrics`** - Prometheus metrics (HTTP GET)
- **`/shutdown`** - Graceful shutdown (HTTP POST with auth)

### Security Features

- **Challenge-Response Authentication**: ECDSA signature verification
- **Message Authentication**: All DKG messages are cryptographically signed
- **Session Isolation**: Each DKG ceremony runs in isolated sessions
- **Rate Limiting**: Protection against DoS attacks
- **Input Validation**: All message payloads are validated

### Protocol Support

- **FROST DKG**: 3-round distributed key generation
- **Interactive Signing**: 2-round threshold signing
- **Multiple Sessions**: Concurrent DKG ceremonies
- **Participant Management**: Roster-based access control

## Monitoring and Observability

### Logging

The server uses structured logging with configurable levels:

```bash
# Set log level via environment
export DKG_SERVER_LOG_LEVEL=debug

# Or via command line
./fserver server --bind 0.0.0.0:9000 --log-level debug
```

Log formats:
- **JSON** (production): Structured logs for log aggregation
- **Pretty** (development): Human-readable console output

### Metrics

Prometheus metrics available at `/metrics`:

- `dkg_active_sessions_total` - Number of active DKG sessions
- `dkg_completed_sessions_total` - Number of completed sessions  
- `dkg_failed_sessions_total` - Number of failed sessions
- `dkg_active_connections_total` - Number of active WebSocket connections
- `dkg_messages_total` - Total messages processed by type
- `dkg_session_duration_seconds` - Session duration histogram

### Health Checks

Health check endpoint returns:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime_seconds": 3600,
  "active_sessions": 2,
  "active_connections": 5,
  "memory_usage_bytes": 52428800
}
```

## Production Recommendations

### Infrastructure

1. **Load Balancing**: Use sticky sessions for WebSocket connections
2. **TLS Termination**: Use WSS for production (wss://)  
3. **Firewall**: Restrict access to authorized participants only
4. **Resource Limits**: Set appropriate CPU/memory limits
5. **Backup**: Regular backup of session data (if persistent)

### Security

1. **Network Isolation**: Run in private network/VPC
2. **Authentication**: Use strong ECDSA keys for participants
3. **Rate Limiting**: Implement connection and message rate limits
4. **Monitoring**: Monitor for suspicious activity patterns
5. **Updates**: Keep dependencies updated for security patches

### Scalability

1. **Horizontal Scaling**: Run multiple instances behind load balancer
2. **Session Persistence**: Use Redis/database for session state (if needed)
3. **Connection Limits**: Set per-instance connection limits
4. **Resource Monitoring**: Monitor CPU, memory, and network usage

## Troubleshooting

### Common Issues

**1. Connection Refused**
```bash
# Check if server is running
curl -f http://localhost:9002/health

# Check logs
docker logs tokamak-dkg-server
```

**2. Authentication Failures** 
```bash
# Verify ECDSA key format (33-byte compressed)
echo $DKG_ECDSA_PRIV_HEX | wc -c  # Should be 65 (64 hex + newline)

# Check participant roster registration
curl -s http://localhost:9002/health | jq .active_sessions

# If authentication fails with "ECDSA signature verification failed":
# 1. Restart the server to clear corrupted session state
pkill -f fserver
cd frost-dkg && ./target/release/fserver server --bind 0.0.0.0:9000

# 2. Recreate session with your public key before authenticating
# 3. Ensure the same keypair is used for both session creation and authentication
```

**3. Server Crashes or State Corruption**
```bash
# Check if server is still running
ps aux | grep fserver

# Kill all fserver processes
pkill -f fserver

# Restart server (choose one method):

# Method 1: Direct binary
cd frost-dkg && ./target/release/fserver server --bind 0.0.0.0:9000

# Method 2: Docker
docker restart tokamak-dkg-server

# Method 3: Using scripts
./scripts/stop-server.sh && ./scripts/start-server.sh

# Verify server is running
curl -f http://localhost:9000/health || echo "Health endpoint not available"
```

**4. Performance Issues**
```bash
# Check metrics
curl http://localhost:9001/metrics | grep dkg_

# Monitor resource usage  
docker stats tokamak-dkg-server
```

### Debugging

Enable debug logging:

```bash
# Docker
docker run -e DKG_SERVER_LOG_LEVEL=debug tokamak-dkg-server

# Direct binary
./fserver server --bind 0.0.0.0:9000 --log-level debug
```

## Development

### Building from Source

```bash
# Clone the repository
git clone <repo-url>
cd frost-dkg

# Build all components
cargo build --release

# Run tests
cargo test

# Build just the server
cargo build --release -p fserver
```

### Local Development

```bash
# Start development server
cargo run -p fserver -- server --bind 127.0.0.1:9000

# Generate test users
node scripts/make_users.js users 3

# Run DKG test
make all out=test_dkg t=2 n=3 gid=testgroup topic=test
```

This completes the production deployment guide for the Tokamak DKG server.