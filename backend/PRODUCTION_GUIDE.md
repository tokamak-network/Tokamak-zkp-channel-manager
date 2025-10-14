# Tokamak DKG Server - Production Deployment Guide

This guide provides step-by-step instructions for deploying the Tokamak FROST DKG server in production environments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Deployment Methods](#deployment-methods)
4. [Configuration](#configuration)
5. [Security Setup](#security-setup)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [Maintenance](#maintenance)
8. [Troubleshooting](#troubleshooting)

## Quick Start

### Option 1: Direct Binary Deployment (Recommended for getting started)

```bash
# 1. Initialize the frost-dkg submodule
git submodule update --init --recursive

# 2. Build the server
cd backend
./scripts/build-server.sh binary

# 3. Start the server
./scripts/start-server.sh

# 4. Check status
./scripts/health-check.sh
```

The server will be available at:
- WebSocket: `ws://localhost:9000/ws`
- Health Check: `http://localhost:9002/health`
- Metrics: `http://localhost:9001/metrics`

### Option 2: Docker Deployment (Recommended for production)

```bash
# 1. Build and start with Docker
cd backend
./scripts/docker-build.sh build-and-start

# 2. Check status
docker logs -f tokamak-dkg-server
```

### Option 3: Docker Compose (Full stack with monitoring)

```bash
# 1. Start the complete stack
cd backend
docker-compose up -d

# 2. Access services
# - DKG Server: ws://localhost:9000/ws
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3000 (admin/admin)
```

## Prerequisites

### System Requirements

**Minimum (Development):**
- CPU: 1 core
- RAM: 512MB
- Disk: 1GB free space
- Network: Internet access for dependencies

**Recommended (Production):**
- CPU: 2+ cores
- RAM: 2GB+
- Disk: 10GB+ free space
- Network: Dedicated server with static IP

### Software Dependencies

**Required:**
- Linux/macOS/Windows with WSL2
- Git with submodules support

**For Binary Deployment:**
- Rust 1.75+ and Cargo
- OpenSSL development headers
- pkg-config

**For Docker Deployment:**
- Docker 20.10+
- Docker Compose 2.0+ (optional)

**For Kubernetes Deployment:**
- kubectl
- Access to Kubernetes cluster
- Helm (optional)

### Installation Commands

**Ubuntu/Debian:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install dependencies
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev git

# Install Docker (optional)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

**CentOS/RHEL:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install dependencies  
sudo yum update
sudo yum groupinstall -y "Development Tools"
sudo yum install -y openssl-devel git

# Install Docker (optional)
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
```

**macOS:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install dependencies (requires Xcode Command Line Tools)
xcode-select --install

# Install Docker (optional)
brew install docker docker-compose
```

## Deployment Methods

### Method 1: Direct Binary Deployment

This method builds and runs the fserver binary directly on the host system.

#### Step 1: Prepare the Environment

```bash
# Clone the repository
git clone <your-repo-url>
cd Tokamak-Zk-Rollup-UI

# Initialize submodules
git submodule update --init --recursive

# Verify frost-dkg is available
ls -la frost-dkg/fserver/src/main.rs
```

#### Step 2: Build the Server

```bash
cd backend

# Build the binary
./scripts/build-server.sh binary

# Verify the build
ls -la bin/fserver
./bin/fserver --help
```

#### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration (see Configuration section)
nano .env

# Key settings for production:
# DKG_SERVER_BIND=0.0.0.0:9000
# DKG_SERVER_LOG_LEVEL=info
# DKG_SERVER_DEV_MODE=false
# DKG_MAX_CONNECTIONS=100
```

#### Step 4: Start the Server

```bash
# Start server
./scripts/start-server.sh

# Check status
./scripts/health-check.sh

# View logs
tail -f logs/fserver.log
```

#### Step 5: Set Up as System Service (Optional)

```bash
# Create systemd service file
sudo nano /etc/systemd/system/tokamak-dkg.service
```

```ini
[Unit]
Description=Tokamak DKG Server
After=network.target

[Service]
Type=forking
User=dkg
Group=dkg
WorkingDirectory=/opt/tokamak-dkg
ExecStart=/opt/tokamak-dkg/scripts/start-server.sh
ExecStop=/opt/tokamak-dkg/scripts/stop-server.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable tokamak-dkg
sudo systemctl start tokamak-dkg

# Check status
sudo systemctl status tokamak-dkg
```

### Method 2: Docker Deployment

This method uses Docker containers for deployment.

#### Step 1: Build Docker Image

```bash
cd backend

# Build the Docker image
./scripts/docker-build.sh build

# Verify the image
docker images tokamak-dkg-server
```

#### Step 2: Run with Docker

**Interactive Mode (Development):**
```bash
./scripts/docker-build.sh run
```

**Background Mode (Production):**
```bash
./scripts/docker-build.sh start

# Check status
docker ps
docker logs tokamak-dkg-server

# Health check
curl -f http://localhost:9002/health
```

#### Step 3: Docker Compose Setup

```bash
# Start complete stack
docker-compose up -d

# Check all services
docker-compose ps

# View logs
docker-compose logs -f tokamak-dkg-server

# Stop stack
docker-compose down
```

### Method 3: Kubernetes Deployment

This method deploys to a Kubernetes cluster.

#### Step 1: Prepare Kubernetes Manifests

```bash
cd backend/k8s

# Review and customize configurations
nano deployment.yaml
nano configmap.yaml
```

#### Step 2: Deploy to Kubernetes

```bash
# Create namespace (optional)
kubectl create namespace tokamak-dkg

# Deploy configuration
kubectl apply -f configmap.yaml -n tokamak-dkg

# Deploy application
kubectl apply -f deployment.yaml -n tokamak-dkg

# Check deployment
kubectl get pods -n tokamak-dkg
kubectl logs -f deployment/tokamak-dkg-server -n tokamak-dkg
```

#### Step 3: Expose Service

```bash
# For development (port-forward)
kubectl port-forward service/tokamak-dkg-server 9000:9000 -n tokamak-dkg

# For production (LoadBalancer/Ingress)
kubectl apply -f service.yaml -n tokamak-dkg
kubectl get services -n tokamak-dkg
```

## Configuration

### Environment Variables

The server supports extensive configuration through environment variables. Copy `.env.example` to `.env` and customize:

#### Core Settings

```bash
# Server bind address
DKG_SERVER_BIND=0.0.0.0:9000

# Log level: error, warn, info, debug, trace
DKG_SERVER_LOG_LEVEL=info

# Development mode (disable in production)
DKG_SERVER_DEV_MODE=false
```

#### Security Settings

```bash
# Connection limits
DKG_MAX_CONNECTIONS=100
DKG_SESSION_TIMEOUT=3600

# Rate limiting
DKG_RATE_LIMIT_CONNECTIONS=10
DKG_RATE_LIMIT_MESSAGES=100

# Authentication
DKG_CHALLENGE_TIMEOUT=300
DKG_ADMIN_TOKEN=$(openssl rand -hex 32)
```

#### TLS Configuration (Recommended for Production)

```bash
# Enable TLS
DKG_ENABLE_TLS=true

# Certificate paths
DKG_TLS_CERT_PATH=/etc/ssl/certs/server.crt
DKG_TLS_KEY_PATH=/etc/ssl/private/server.key
```

#### Monitoring Settings

```bash
# Metrics and health check ports
DKG_METRICS_PORT=9001
DKG_HEALTH_CHECK_PORT=9002
DKG_ENABLE_METRICS=true

# Log format (json for production)
DKG_LOG_FORMAT=json
```

### Configuration Files

For advanced configuration, you can use TOML configuration files:

**config/server.toml:**
```toml
[server]
bind = "0.0.0.0:9000"
log_level = "info"
dev_mode = false

[security]
max_connections = 100
session_timeout = 3600
enable_tls = true

[monitoring]  
metrics_port = 9001
health_check_port = 9002
enable_prometheus = true
```

## Security Setup

### 1. TLS/SSL Configuration

**Generate Self-Signed Certificate (Development):**
```bash
# Create certificate directory
sudo mkdir -p /etc/ssl/tokamak-dkg

# Generate private key
sudo openssl genrsa -out /etc/ssl/tokamak-dkg/server.key 2048

# Generate certificate
sudo openssl req -new -x509 -key /etc/ssl/tokamak-dkg/server.key \
  -out /etc/ssl/tokamak-dkg/server.crt -days 365

# Set permissions
sudo chown -R dkg:dkg /etc/ssl/tokamak-dkg
sudo chmod 600 /etc/ssl/tokamak-dkg/server.key
sudo chmod 644 /etc/ssl/tokamak-dkg/server.crt
```

**Using Let's Encrypt (Production):**
```bash
# Install certbot
sudo apt install -y certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Set paths in .env
DKG_TLS_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
DKG_TLS_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
```

### 2. Firewall Configuration

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 9000/tcp comment "DKG WebSocket"
sudo ufw allow 9002/tcp comment "DKG Health Check"
sudo ufw enable

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --permanent --add-port=9002/tcp  
sudo firewall-cmd --reload
```

### 3. User and Permission Setup

```bash
# Create dedicated user
sudo useradd --system --shell /bin/bash --home /opt/tokamak-dkg dkg

# Set up directories
sudo mkdir -p /opt/tokamak-dkg/{bin,data,logs,config}
sudo chown -R dkg:dkg /opt/tokamak-dkg

# Copy application
sudo cp -r backend/* /opt/tokamak-dkg/
sudo chown -R dkg:dkg /opt/tokamak-dkg
```

### 4. Network Security

**Reverse Proxy with Nginx:**
```nginx
# /etc/nginx/sites-available/tokamak-dkg
upstream tokamak_dkg {
    server 127.0.0.1:9000;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    
    location /ws {
        proxy_pass http://tokamak_dkg;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeout
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
    
    location /health {
        proxy_pass http://127.0.0.1:9002;
        access_log off;
    }
}
```

## Monitoring and Observability

### 1. Health Checks

The server exposes several health check endpoints:

```bash
# Basic health check
curl -f http://localhost:9002/health

# Detailed health information
curl http://localhost:9002/health | jq .

# Automated monitoring
./scripts/health-check.sh
```

### 2. Metrics Collection

**Prometheus Metrics:**
```bash
# View available metrics
curl http://localhost:9001/metrics

# Key metrics to monitor:
# - dkg_active_sessions_total
# - dkg_completed_sessions_total
# - dkg_failed_sessions_total
# - dkg_active_connections_total
# - dkg_messages_total
# - dkg_session_duration_seconds
```

**Prometheus Configuration:**
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'tokamak-dkg'
    static_configs:
      - targets: ['localhost:9001']
    scrape_interval: 30s
    metrics_path: /metrics
```

### 3. Logging

**Log Locations:**
- Binary deployment: `./logs/fserver.log`
- Docker: `docker logs tokamak-dkg-server`
- Kubernetes: `kubectl logs deployment/tokamak-dkg-server`

**Log Formats:**
```bash
# JSON format (production)
export DKG_LOG_FORMAT=json

# Pretty format (development)
export DKG_LOG_FORMAT=pretty
```

**Log Aggregation (ELK Stack):**
```yaml
# filebeat.yml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /opt/tokamak-dkg/logs/*.log
  fields:
    service: tokamak-dkg
  fields_under_root: true

output.elasticsearch:
  hosts: ["localhost:9200"]

setup.kibana:
  host: "localhost:5601"
```

### 4. Alerting

**Prometheus Alerting Rules:**
```yaml
# alert-rules.yml
groups:
- name: tokamak-dkg
  rules:
  - alert: DKGServerDown
    expr: up{job="tokamak-dkg"} == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Tokamak DKG server is down"
      
  - alert: HighFailureRate  
    expr: rate(dkg_failed_sessions_total[5m]) > 0.1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High DKG session failure rate"
```

## Maintenance

### 1. Backup Procedures

**Session Data Backup:**
```bash
# Backup session data
tar -czf backup-$(date +%Y%m%d).tar.gz data/ logs/

# Automated backup script
#!/bin/bash
BACKUP_DIR="/opt/backups/tokamak-dkg"
DATE=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/tokamak-dkg-$DATE.tar.gz" \
    /opt/tokamak-dkg/data \
    /opt/tokamak-dkg/logs \
    /opt/tokamak-dkg/.env

# Keep only last 30 backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
```

### 2. Updates and Upgrades

**Binary Deployment:**
```bash
# Stop server
./scripts/stop-server.sh

# Backup current installation
cp bin/fserver bin/fserver.backup

# Update code and rebuild
git pull
git submodule update --recursive
./scripts/build-server.sh binary

# Start server
./scripts/start-server.sh

# Verify operation
./scripts/health-check.sh
```

**Docker Deployment:**
```bash
# Build new image
./scripts/docker-build.sh build tokamak-dkg-server:new

# Stop current container
docker stop tokamak-dkg-server

# Start with new image
docker run -d --name tokamak-dkg-server-new \
  -p 9000:9000 -p 9001:9001 -p 9002:9002 \
  tokamak-dkg-server:new

# Verify and swap
docker stop tokamak-dkg-server-new
docker rename tokamak-dkg-server tokamak-dkg-server-old
docker rename tokamak-dkg-server-new tokamak-dkg-server
```

### 3. Log Rotation

**Logrotate Configuration:**
```bash
# /etc/logrotate.d/tokamak-dkg
/opt/tokamak-dkg/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    postrotate
        systemctl reload tokamak-dkg || true
    endscript
}
```

### 4. Performance Tuning

**System Limits:**
```bash
# /etc/security/limits.d/tokamak-dkg.conf
dkg soft nofile 65536
dkg hard nofile 65536
dkg soft nproc 4096
dkg hard nproc 4096
```

**Kernel Parameters:**
```bash
# /etc/sysctl.d/tokamak-dkg.conf
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024
net.core.netdev_max_backlog = 5000
```

## Troubleshooting

### Common Issues

#### 1. Server Won't Start

**Problem:** "Address already in use" error
```bash
# Check what's using the port
sudo netstat -tulpn | grep :9000
sudo lsof -i :9000

# Kill the process or change port
export DKG_SERVER_BIND=0.0.0.0:9001
```

**Problem:** "Permission denied" error
```bash
# Check file permissions
ls -la bin/fserver

# Fix permissions
chmod +x bin/fserver
chown dkg:dkg bin/fserver
```

#### 2. Connection Issues

**Problem:** Clients can't connect to WebSocket
```bash
# Check if server is running
curl -f http://localhost:9002/health

# Check firewall
sudo ufw status
telnet localhost 9000

# Check logs
tail -f logs/fserver.log
```

**Problem:** TLS/WSS connection issues
```bash
# Verify certificate
openssl s_client -connect localhost:9000 -servername localhost

# Check certificate expiry  
openssl x509 -in /etc/ssl/certs/server.crt -text -noout | grep "Not After"
```

#### 3. Performance Issues

**Problem:** High CPU usage
```bash
# Check system resources
top -p $(pgrep fserver)
htop

# Check connection count
curl http://localhost:9001/metrics | grep dkg_active_connections

# Review configuration
grep -E "(MAX_CONNECTIONS|WORKER_THREADS)" .env
```

**Problem:** Memory leaks
```bash
# Monitor memory usage
watch -n 5 'ps aux | grep fserver'

# Check for memory metrics
curl http://localhost:9001/metrics | grep memory

# Enable memory debugging
export DKG_SERVER_LOG_LEVEL=debug
```

#### 4. DKG Protocol Issues

**Problem:** Authentication failures
```bash
# Check participant keys
grep "authentication failed" logs/fserver.log

# Verify ECDSA key format
echo $DKG_ECDSA_PRIV_HEX | wc -c  # Should be 65

# Check roster configuration
curl http://localhost:9002/health | jq .active_sessions
```

**Problem:** Session timeouts
```bash
# Increase session timeout
export DKG_SESSION_TIMEOUT=7200

# Check network connectivity between participants
ping participant-host

# Review session logs
grep "session.*timeout" logs/fserver.log
```

### Log Analysis

**Important Log Patterns:**
```bash
# Authentication events
grep -E "(Challenge|Login)" logs/fserver.log

# Session lifecycle
grep -E "(SessionCreated|ReadyRound|Finalized)" logs/fserver.log

# Error patterns
grep -E "(ERROR|WARN|Failed)" logs/fserver.log

# Performance metrics
grep -E "(duration|connections|memory)" logs/fserver.log
```

### Recovery Procedures

**Graceful Restart:**
```bash
# Send SIGTERM for graceful shutdown
kill -TERM $(cat data/fserver.pid)

# Wait for completion
sleep 10

# Start server
./scripts/start-server.sh
```

**Emergency Restart:**
```bash
# Force stop
./scripts/stop-server.sh

# Clear temporary data
rm -rf data/sessions/*

# Start fresh
./scripts/start-server.sh
```

**Database Recovery (if using persistent storage):**
```bash
# Backup current state
pg_dump dkg_server > backup.sql

# Restore from backup  
psql dkg_server < backup.sql

# Restart services
systemctl restart tokamak-dkg
```

This completes the comprehensive production deployment guide for the Tokamak DKG server.