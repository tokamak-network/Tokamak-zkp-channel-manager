#!/bin/bash

# Tokamak DKG Server - Build Script
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TOKAMAK_ROOT="$(dirname "$PROJECT_ROOT")"
FROST_DKG_DIR="$TOKAMAK_ROOT/frost-dkg"

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
    
    # Check if Rust is installed
    if ! command -v cargo &> /dev/null; then
        log_error "Cargo not found. Please install Rust: https://rustup.rs/"
        exit 1
    fi
    
    # Check if Docker is installed (for container builds)
    if ! command -v docker &> /dev/null; then
        log_warn "Docker not found. Container builds will not be available."
    fi
    
    # Check if frost-dkg directory exists
    if [[ ! -d "$FROST_DKG_DIR" ]]; then
        log_error "frost-dkg directory not found at: $FROST_DKG_DIR"
        log_error "Please initialize the frost-dkg submodule:"
        log_error "  git submodule update --init --recursive"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Function to build the Rust binary
build_rust_binary() {
    log_step "Building fserver binary from frost-dkg..."
    
    cd "$FROST_DKG_DIR"
    
    # Clean previous builds if requested
    if [[ "${CLEAN_BUILD:-false}" == "true" ]]; then
        log_info "Cleaning previous builds..."
        cargo clean
    fi
    
    # Build the binary
    log_info "Compiling fserver (this may take a while)..."
    cargo build --release -p fserver
    
    # Verify the binary was created
    if [[ -f "target/release/fserver" ]]; then
        log_info "Binary built successfully: $FROST_DKG_DIR/target/release/fserver"
        
        # Show binary info
        local binary_size
        binary_size=$(du -h "$FROST_DKG_DIR/target/release/fserver" | cut -f1)
        log_info "Binary size: $binary_size"
        
        # Test the binary
        if "$FROST_DKG_DIR/target/release/fserver" --help > /dev/null 2>&1; then
            log_info "Binary test passed"
        else
            log_warn "Binary test failed - binary may not be fully functional"
        fi
    else
        log_error "Binary build failed - fserver not found"
        exit 1
    fi
}

# Function to copy binary to backend directory
copy_binary() {
    log_step "Copying binary to backend directory..."
    
    mkdir -p "$PROJECT_ROOT/bin"
    cp "$FROST_DKG_DIR/target/release/fserver" "$PROJECT_ROOT/bin/"
    chmod +x "$PROJECT_ROOT/bin/fserver"
    
    log_info "Binary copied to: $PROJECT_ROOT/bin/fserver"
}

# Function to build Docker image
build_docker_image() {
    if ! command -v docker &> /dev/null; then
        log_warn "Docker not available, skipping container build"
        return 0
    fi
    
    log_step "Building Docker image..."
    
    cd "$PROJECT_ROOT"
    
    # Build the Docker image
    docker build -t tokamak-dkg-server:latest .
    
    if [[ $? -eq 0 ]]; then
        log_info "Docker image built successfully: tokamak-dkg-server:latest"
        
        # Show image info
        local image_size
        image_size=$(docker images tokamak-dkg-server:latest --format "table {{.Size}}" | tail -n 1)
        log_info "Image size: $image_size"
    else
        log_error "Docker image build failed"
        exit 1
    fi
}

# Function to run tests
run_tests() {
    log_step "Running tests..."
    
    cd "$FROST_DKG_DIR"
    
    # Run Rust tests
    log_info "Running Rust unit tests..."
    cargo test -p fserver --release
    
    if [[ $? -eq 0 ]]; then
        log_info "All tests passed"
    else
        log_error "Some tests failed"
        exit 1
    fi
}

# Function to create release package
create_release_package() {
    local version="${1:-$(date +%Y%m%d-%H%M%S)}"
    
    log_step "Creating release package..."
    
    local release_dir="$PROJECT_ROOT/releases/tokamak-dkg-server-$version"
    mkdir -p "$release_dir"
    
    # Copy binary
    cp "$PROJECT_ROOT/bin/fserver" "$release_dir/"
    
    # Copy scripts
    cp -r "$PROJECT_ROOT/scripts" "$release_dir/"
    
    # Copy configuration
    cp -r "$PROJECT_ROOT/config" "$release_dir/" 2>/dev/null || true
    
    # Copy documentation
    cp "$PROJECT_ROOT/README.md" "$release_dir/"
    
    # Create archive
    cd "$PROJECT_ROOT/releases"
    tar -czf "tokamak-dkg-server-$version.tar.gz" "tokamak-dkg-server-$version/"
    
    log_info "Release package created: $PROJECT_ROOT/releases/tokamak-dkg-server-$version.tar.gz"
}

# Main build function
main() {
    local build_type="${1:-all}"
    
    log_info "Starting Tokamak DKG Server build process..."
    log_info "Build type: $build_type"
    echo ""
    
    case "$build_type" in
        "binary" | "rust")
            check_prerequisites
            build_rust_binary
            copy_binary
            ;;
        "docker" | "container")
            check_prerequisites
            build_rust_binary
            copy_binary
            build_docker_image
            ;;
        "test")
            check_prerequisites
            run_tests
            ;;
        "release")
            check_prerequisites
            build_rust_binary
            copy_binary
            run_tests
            build_docker_image
            create_release_package "${2:-}"
            ;;
        "all")
            check_prerequisites
            build_rust_binary
            copy_binary
            run_tests
            build_docker_image
            ;;
        "clean")
            log_step "Cleaning build artifacts..."
            cd "$FROST_DKG_DIR"
            cargo clean
            rm -rf "$PROJECT_ROOT/bin"
            rm -rf "$PROJECT_ROOT/releases"
            docker rmi tokamak-dkg-server:latest 2>/dev/null || true
            log_info "Clean completed"
            ;;
        *)
            log_error "Unknown build type: $build_type"
            echo ""
            echo "Usage: $0 [binary|docker|test|release|all|clean]"
            echo ""
            echo "Build types:"
            echo "  binary   - Build only the Rust binary"
            echo "  docker   - Build binary and Docker image"  
            echo "  test     - Run tests only"
            echo "  release  - Full build with release package"
            echo "  all      - Build binary, run tests, and create Docker image (default)"
            echo "  clean    - Clean all build artifacts"
            echo ""
            echo "Environment variables:"
            echo "  CLEAN_BUILD=true - Clean before building"
            exit 1
            ;;
    esac
    
    log_info "Build process completed successfully!"
}

# Run main function with all arguments
main "$@"