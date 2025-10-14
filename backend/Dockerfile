# Multi-stage build for Tokamak DKG Server
FROM rust:1.75-bookworm as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy the frost-dkg source code from the parent directory
# Note: Docker build context should be set to the parent directory
COPY frost-dkg ./frost-dkg/

# Build the fserver binary
WORKDIR /app/frost-dkg
RUN cargo build --release -p fserver

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash dkg

# Create app directory
WORKDIR /app

# Copy the built binary from builder stage
COPY --from=builder /app/frost-dkg/target/release/fserver /usr/local/bin/fserver

# Copy scripts and configuration
COPY scripts/ ./scripts/
COPY config/ ./config/

# Make scripts executable
RUN chmod +x ./scripts/*.sh

# Create directories for data and logs
RUN mkdir -p /app/data /app/logs && \
    chown -R dkg:dkg /app

# Switch to non-root user
USER dkg

# Expose ports
EXPOSE 9000 9001 9002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9002/health || exit 1

# Default environment variables
ENV DKG_SERVER_BIND=0.0.0.0:9000
ENV DKG_SERVER_LOG_LEVEL=info
ENV DKG_SERVER_DEV_MODE=false
ENV DKG_METRICS_PORT=9001
ENV DKG_HEALTH_CHECK_PORT=9002

# Run the server
CMD ["fserver", "server", "--bind", "0.0.0.0:9000"]