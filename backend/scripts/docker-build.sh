#!/bin/bash

# Tokamak DKG Server - Docker Build Script
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"

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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check if frost-dkg directory exists
    if [[ ! -d "$PROJECT_ROOT/frost-dkg" ]]; then
        log_error "frost-dkg directory not found at: $PROJECT_ROOT/frost-dkg"
        log_error "Please initialize the frost-dkg submodule:"
        log_error "  git submodule update --init --recursive"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Function to build Docker image
build_image() {
    local tag="${1:-tokamak-dkg-server:latest}"
    
    log_step "Building Docker image: $tag"
    
    # Build from the project root to include frost-dkg
    cd "$PROJECT_ROOT"
    
    # Build the Docker image with correct context
    docker build \
        -f backend/Dockerfile \
        -t "$tag" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
        .
    
    if [[ $? -eq 0 ]]; then
        log_info "Docker image built successfully: $tag"
        
        # Show image info
        local image_size
        image_size=$(docker images "$tag" --format "table {{.Size}}" | tail -n 1)
        log_info "Image size: $image_size"
        
        # Test the image
        log_step "Testing the built image..."
        if docker run --rm "$tag" fserver --help > /dev/null 2>&1; then
            log_info "Image test passed"
        else
            log_warn "Image test failed - image may not be fully functional"
        fi
        
    else
        log_error "Docker image build failed"
        exit 1
    fi
}

# Function to run the container
run_container() {
    local tag="${1:-tokamak-dkg-server:latest}"
    local detached="${2:-false}"
    
    log_step "Running container from image: $tag"
    
    local run_args=()
    
    # Add detached flag if requested
    if [[ "$detached" == "true" ]]; then
        run_args+=("-d")
        run_args+=("--name" "tokamak-dkg-server")
        run_args+=("--restart" "unless-stopped")
    else
        run_args+=("--rm")
    fi
    
    # Port mappings
    run_args+=("-p" "9000:9000")  # WebSocket
    run_args+=("-p" "9001:9001")  # Metrics
    run_args+=("-p" "9002:9002")  # Health check
    
    # Environment variables
    run_args+=("-e" "DKG_SERVER_LOG_LEVEL=info")
    run_args+=("-e" "DKG_SERVER_DEV_MODE=false")
    
    # Run the container
    docker run "${run_args[@]}" "$tag"
    
    if [[ "$detached" == "true" ]]; then
        log_info "Container started in detached mode"
        log_info "WebSocket endpoint: ws://localhost:9000/ws"
        log_info "Health check: http://localhost:9002/health"
        log_info "Metrics: http://localhost:9001/metrics"
        log_info ""
        log_info "To stop: docker stop tokamak-dkg-server"
        log_info "To view logs: docker logs -f tokamak-dkg-server"
    fi
}

# Function to push image to registry
push_image() {
    local tag="${1:-tokamak-dkg-server:latest}"
    local registry="${2:-}"
    
    if [[ -n "$registry" ]]; then
        local remote_tag="$registry/$tag"
        log_step "Tagging image for registry: $remote_tag"
        docker tag "$tag" "$remote_tag"
        
        log_step "Pushing image to registry: $remote_tag"
        docker push "$remote_tag"
        
        if [[ $? -eq 0 ]]; then
            log_info "Image pushed successfully: $remote_tag"
        else
            log_error "Failed to push image to registry"
            exit 1
        fi
    else
        log_warn "No registry specified, skipping push"
    fi
}

# Main function
main() {
    local action="${1:-build}"
    local tag="${2:-tokamak-dkg-server:latest}"
    
    log_info "Tokamak DKG Server Docker Build"
    log_info "Action: $action"
    log_info "Tag: $tag"
    echo ""
    
    case "$action" in
        "build")
            check_prerequisites
            build_image "$tag"
            ;;
        "run")
            run_container "$tag" "false"
            ;;
        "start")
            run_container "$tag" "true"
            ;;
        "build-and-run")
            check_prerequisites
            build_image "$tag"
            run_container "$tag" "false"
            ;;
        "build-and-start")
            check_prerequisites
            build_image "$tag"
            run_container "$tag" "true"
            ;;
        "push")
            local registry="${3:-}"
            push_image "$tag" "$registry"
            ;;
        "clean")
            log_step "Cleaning Docker artifacts..."
            
            # Stop and remove container if running
            docker stop tokamak-dkg-server 2>/dev/null || true
            docker rm tokamak-dkg-server 2>/dev/null || true
            
            # Remove images
            docker rmi "$tag" 2>/dev/null || true
            docker rmi tokamak-dkg-server:latest 2>/dev/null || true
            
            # Clean up dangling images
            docker image prune -f
            
            log_info "Clean completed"
            ;;
        "help" | "-h" | "--help")
            echo "Usage: $0 [action] [tag] [registry]"
            echo ""
            echo "Actions:"
            echo "  build           - Build Docker image (default)"
            echo "  run             - Run container interactively"
            echo "  start           - Start container in background"
            echo "  build-and-run   - Build image and run interactively"
            echo "  build-and-start - Build image and start in background"
            echo "  push            - Push image to registry"
            echo "  clean           - Clean up Docker artifacts"
            echo "  help            - Show this help message"
            echo ""
            echo "Arguments:"
            echo "  tag             - Docker image tag (default: tokamak-dkg-server:latest)"
            echo "  registry        - Registry URL for push action"
            echo ""
            echo "Examples:"
            echo "  $0 build"
            echo "  $0 build my-registry/tokamak-dkg-server:v1.0.0"
            echo "  $0 build-and-start"
            echo "  $0 push tokamak-dkg-server:latest my-registry.com"
            ;;
        *)
            log_error "Unknown action: $action"
            log_info "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
    
    log_info "Docker operation completed successfully!"
}

# Run main function with all arguments
main "$@"