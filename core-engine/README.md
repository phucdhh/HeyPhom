# HeyPhom Core Engine

RealityKit-based photogrammetry processing engine for macOS Apple Silicon.

## Features

- ✅ RealityKit PhotogrammetrySession integration
- ✅ Supports JPEG, PNG, HEIC from any camera
- ✅ High-quality 3D model generation (USDZ)
- ✅ Multiple quality levels: low, medium, high, ultra
- ✅ Sequential sample ordering for M2 optimization
- ✅ Automatic checkpoint management

## Requirements

- macOS 13.0+ (Ventura or later)
- Apple Silicon (M1/M2/M3/M4)
- 20-30+ images with 60-80% overlap
- sudo access (for resource allocation)

## Installation

```bash
cd /Users/mac/HeyPhom/core-engine
swift build -c release
```

## Usage

### Using the wrapper script (recommended):
```bash
./run-heyphom.sh --input ./photos --output ./output
```

### Direct usage:
```bash
sudo .build/arm64-apple-macosx/release/heyphom-cli --input ./photos --output ./output
```

### Options:
- `--input, -i <PATH>`: Input directory containing images
- `--output, -o <PATH>`: Output directory for 3D models
- `--quality, -q <QUALITY>`: Processing quality (low|medium|high|ultra)
- `--formats, -f <FORMATS>`: Output formats (usdz,obj)

## Examples

```bash
# Basic usage
./run-heyphom.sh -i ./photos -o ./output

# High quality processing
./run-heyphom.sh -i ./photos -o ./output -q ultra

# Custom output format
./run-heyphom.sh -i ./photos -o ./output -f usdz
```

## Output

The engine generates:
- `model.usdz`: 3D model in USDZ format
- `checkpoints/`: Intermediate processing data
- Processing logs and statistics

## Known Issues

- Requires sudo for proper memory allocation (macOS system limitation)
- Output files created as root (automatically fixed by wrapper script)

## Architecture

```
core-engine/
├── Package.swift         # Swift Package Manager config
├── Sources/
│   └── main.swift       # Main CLI implementation
├── run-heyphom.sh       # Wrapper script with sudo handling
└── .build/              # Build artifacts
    └── release/
        └── heyphom-cli  # Compiled binary
```

## Development

Build for debugging:
```bash
swift build
```

Build for release:
```bash
swift build -c release
```

Run tests:
```bash
swift test
```

## License

Proprietary - HeyPhom Project
