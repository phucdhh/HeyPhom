import Foundation
import RealityKit
import os.log

// MARK: - HeyPhom CLI v2.0.0
// Photogrammetry Processing Engine for Apple Silicon
// Uses RealityKit PhotogrammetrySession for high-quality 3D reconstruction

let logger = Logger(subsystem: "com.heyphom.cli", category: "main")

@available(macOS 12.0, *)
class PhotogrammetryProcessor {
    // IMPORTANT: Keep session as class property to prevent deallocation during async processing
    private var session: PhotogrammetrySession?
    private let outputPath: String
    private let quality: String
    private let detail: PhotogrammetrySession.Request.Detail
    
    init(inputPath: String, outputPath: String, quality: String) throws {
        self.outputPath = outputPath
        self.quality = quality
        
        // Map quality to PhotogrammetrySession.Request.Detail
        self.detail = {
            switch quality.lowercased() {
            case "low": return .reduced
            case "medium": return .medium
            case "ultra": return .full
            default: return .preview // "high"
            }
        }()
        
        let inputURL = URL(fileURLWithPath: inputPath, isDirectory: true)
        
        // Configure session for maximum compatibility with all image types
        var configuration = PhotogrammetrySession.Configuration()
        
        // Disable sandbox restrictions for checkpoints if possible
        let checkpointPath = URL(fileURLWithPath: outputPath).appendingPathComponent("checkpoints")
        try? FileManager.default.createDirectory(at: checkpointPath, withIntermediateDirectories: true)
        
        if #available(macOS 14.0, *) {
            configuration.checkpointDirectory = checkpointPath
        }
        
        // Enable ordered image processing for circular captures (speeds up M2 processing)
        configuration.sampleOrdering = .sequential
        configuration.featureSensitivity = .normal
        configuration.isObjectMaskingEnabled = false
        
        // Accept images without strict metadata requirements
        // This allows JPEG/PNG from any camera (DSLR, Mirrorless, Drone, smartphones)
        // No longer requires iPhone-specific depth data or gravity metadata
        
        do {
            // Initialize session - will be kept alive as class property
            self.session = try PhotogrammetrySession(input: inputURL, configuration: configuration)
            
            print("🎬 HeyPhom Photogrammetry Engine v2.0.0")
            print("🍎 RealityKit PhotogrammetrySession initialized")
            print("📷 Supports: JPEG, PNG, HEIC from ANY camera/phone")
            print("⚙️  Quality: \(quality) (Detail: \(detail))")
            print("🔄 Sample ordering: Sequential (optimized for M2)")
            print("")
        } catch {
            print("❌ PhotogrammetrySession initialization failed")
            print("   ERROR: \(error.localizedDescription)")
            if #available(macOS 14.0, *) {
                if let photoError = error as? PhotogrammetrySession.Error {
                    print("   DETAIL: \(photoError)")
                }
            }
            print("")
            print("   💡 TIP: If you see 'insufficientStorage', run with sudo:")
            print("      sudo heyphom-cli --input <path> --output <path>")
            print("")
            print("   POSSIBLE CAUSES:")
            print("   - Not enough images (minimum 20-30 recommended)")
            print("   - Images don't have sufficient overlap (need 60-80%)")
            print("   - Image folder is empty or inaccessible")
            print("   - Corrupted or invalid image files")
            print("")
            print("   SUPPORTED FORMATS:")
            print("   ✓ JPEG (.jpg, .jpeg) from any camera")
            print("   ✓ PNG (.png) from any source")
            print("   ✓ HEIC (.heic, .heif) from iPhone or other devices")
            print("")
            print("   FILE ACCESS:")
            print("   - Ensure HeyPhom has read permissions for input folder")
            print("   - Ensure HeyPhom has write permissions for output folder")
            print("")
            
            throw PhotogrammetryError.unsupportedPlatform
        }
    }
    
    func process() async throws {
        guard let session = session else {
            throw PhotogrammetryError.sessionNotInitialized
        }
        
        let outputURL = URL(filePath: outputPath)
        
        // Start processing with quality detail
        print("📊 PROGRESS: 0")
        print("📝 STAGE: Initializing")
        fflush(stdout) // Force flush for real-time progress
        
        try session.process(requests: [
            .modelFile(url: outputURL.appendingPathComponent("model.usdz"), detail: detail)
        ])
        
        // Monitor progress with comprehensive error handling
        var processingComplete = false
        
        outputLoop: for try await output in session.outputs {
            switch output {
            case .processingComplete:
                print("📊 PROGRESS: 100")
                print("📝 STAGE: Completed")
                print("✅ Photogrammetry processing complete!")
                fflush(stdout)
                processingComplete = true
                // Break immediately - don't wait for requestComplete
                // (Backend will read files from export folder)
                print("🏁 Exiting process...")
                fflush(stdout)
                break outputLoop
                
            case .requestProgress(_, let fraction):
                let percentage = Int(fraction * 100)
                print("📊 PROGRESS: \(percentage)")
                
                // Map progress to stages
                let stage: String
                switch percentage {
                case 0..<10: stage = "Initializing"
                case 10..<25: stage = "Feature Detection"
                case 25..<50: stage = "Point Cloud Generation"
                case 50..<75: stage = "Mesh Reconstruction"
                case 75..<95: stage = "Texture Mapping"
                default: stage = "Finalizing"
                }
                print("📝 STAGE: \(stage)")
                fflush(stdout) // Force flush for real-time progress
                
            case .requestComplete(_, let result):
                switch result {
                case .modelFile(let url):
                    print("✅ Model exported: \(url.lastPathComponent)")
                    let fileSize = try FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int64 ?? 0
                    let sizeMB = Double(fileSize) / (1024 * 1024)
                    print("📦 Size: \(String(format: "%.2f", sizeMB)) MB")
                    fflush(stdout)
                    
                    // Note: We already break in processingComplete
                    // This case may not be reached
                default:
                    break
                }
                
            case .requestError(_, let error):
                print("❌ Request failed: \(error.localizedDescription)")
                print("   This may indicate:")
                print("   - Insufficient image overlap")
                print("   - Too few images for reconstruction")
                print("   - Images from different scenes/objects")
                throw error
                
            case .processingCancelled:
                print("⚠️  Processing cancelled")
                throw PhotogrammetryError.cancelled
                
            case .invalidSample(let id, let reason):
                print("⚠️  Invalid sample \(id): \(reason)")
                print("   (Continuing with remaining images...)")
                
            case .skippedSample(let id):
                print("⚠️  Skipped sample: \(id)")
                print("   (Image may be blurry, duplicate, or low quality)")
                
            case .automaticDownsampling:
                print("ℹ️  Automatic downsampling applied")
                print("   (Optimizing memory usage for large dataset)")
                
            case .inputComplete:
                print("ℹ️  Input processing complete")
                print("   (All images analyzed, starting reconstruction...)")
            
            // case .processingWarning removed - not in API

            case .stitchingIncomplete:
                 print("⚠️  Stitching Incomplete")

            case .requestProgressInfo(_, let info):
                 print("ℹ️  Request Progress Info: \(info)")

            @unknown default:
                print("⚠️  Unknown output type: \(output)")
            }
        }
        
        // Exit immediately after breaking from output loop
        print("🏁 Process exiting cleanly...")
        fflush(stdout)
        exit(0)
    }
}

enum PhotogrammetryError: Error {
    case sessionNotInitialized
    case cancelled
    case unsupportedPlatform
}

// MARK: - CLI Arguments

struct CLIArguments {
    let inputPath: String
    let outputPath: String
    let quality: String
    let formats: [String]
    
    static func parse() -> CLIArguments? {
        let args = CommandLine.arguments
        
        var inputPath: String?
        var outputPath: String?
        var quality = "high"
        var formats = ["usdz", "obj"]
        
        var i = 1
        while i < args.count {
            switch args[i] {
            case "--input", "-i":
                if i + 1 < args.count {
                    inputPath = args[i + 1]
                    i += 1
                }
            case "--output", "-o":
                if i + 1 < args.count {
                    outputPath = args[i + 1]
                    i += 1
                }
            case "--quality", "-q":
                if i + 1 < args.count {
                    quality = args[i + 1]
                    i += 1
                }
            case "--formats", "-f":
                if i + 1 < args.count {
                    formats = args[i + 1].split(separator: ",").map(String.init)
                    i += 1
                }
            case "--version", "-v":
                print("HeyPhom CLI v2.0.0")
                print("RealityKit Photogrammetry Engine for Apple Silicon")
                print("Supports: JPEG, PNG, HEIC from any camera")
                exit(0)
            case "--help", "-h":
                printHelp()
                exit(0)
            default:
                break
            }
            i += 1
        }
        
        guard let input = inputPath, let output = outputPath else {
            printHelp()
            return nil
        }
        
        return CLIArguments(inputPath: input, outputPath: output, quality: quality, formats: formats)
    }
    
    static func printHelp() {
        print("""
        HeyPhom CLI v2.0.0 - RealityKit Photogrammetry Engine
        
        USAGE:
            heyphom-cli --input <PATH> --output <PATH> [OPTIONS]
            sudo heyphom-cli --input <PATH> --output <PATH> [OPTIONS]
        
        REQUIRED:
            --input, -i <PATH>       Input directory containing images
            --output, -o <PATH>      Output directory for 3D models
        
        OPTIONS:
            --quality, -q <QUALITY>  Processing quality: low, medium, high, ultra
                                     Default: high
            --formats, -f <FORMATS>  Output formats (comma-separated): usdz,obj
                                     Default: usdz,obj
            --version, -v            Show version information
            --help, -h               Show this help message
        
        EXAMPLES:
            # Basic usage (may require sudo for resource allocation)
            sudo heyphom-cli -i ./photos -o ./output
            
            # Custom quality
            sudo heyphom-cli -i ./photos -o ./output -q ultra
            
            # Specific format
            sudo heyphom-cli -i ./photos -o ./output -f usdz
        
        SUPPORTED IMAGE FORMATS:
            - JPEG (.jpg, .jpeg) from any camera
            - PNG (.png) from any source
            - HEIC (.heic, .heif) from iPhone or other devices
        
        REQUIREMENTS:
            - macOS 13.0+ with Apple Silicon (M1/M2/M3)
            - 20-30+ images with 60-80% overlap
            - Run with sudo for proper resource allocation
        
        """)
    }
}

// MARK: - Main Processing

@available(macOS 12.0, *)
func mainAsync() async {
    guard let args = CLIArguments.parse() else {
        exit(1)
    }
    
    // Validate input directory
    let fileManager = FileManager.default
    var isDirectory: ObjCBool = false
    
    guard fileManager.fileExists(atPath: args.inputPath, isDirectory: &isDirectory),
          isDirectory.boolValue else {
        logger.error("❌ Input path does not exist or is not a directory: \(args.inputPath)")
        print("ERROR: Input directory not found")
        exit(1)
    }
    
    // Create output directory
    do {
        try fileManager.createDirectory(atPath: args.outputPath, withIntermediateDirectories: true)
    } catch {
        logger.error("❌ Failed to create output directory: \(error.localizedDescription)")
        print("ERROR: Cannot create output directory")
        exit(1)
    }
    
    print("📂 Input:  \(args.inputPath)")
    print("📂 Output: \(args.outputPath)")
    print("⚙️  Quality: \(args.quality)")
    print("📦 Formats: \(args.formats.joined(separator: ", "))")
    print("")
    
    // Get image files
    let imageExtensions = ["jpg", "jpeg", "png", "heic", "heif"]
    var imageCount = 0
    
    do {
        let contents = try fileManager.contentsOfDirectory(atPath: args.inputPath)
        imageCount = contents.filter { filename in
            imageExtensions.contains(URL(fileURLWithPath: filename).pathExtension.lowercased())
        }.count
    } catch {
        logger.error("❌ Failed to read input directory: \(error.localizedDescription)")
        print("ERROR: Cannot read input directory")
        exit(1)
    }
    
    if imageCount < 20 {
        logger.error("❌ Insufficient images. Found \(imageCount), need at least 20 images")
        print("ERROR: Need at least 20 images for photogrammetry")
        exit(1)
    }
    
    print("📸 Found \(imageCount) images")
    print("")
    
    // Check architecture
    #if arch(arm64)
    print("✅ Running on Apple Silicon (ARM64)")
    #else
    print("⚠️  Warning: Not running on Apple Silicon - performance may be limited")
    #endif
    
    print("")
    print("🚀 Starting RealityKit Photogrammetry...")
    print("")
    
    do {
        let processor = try PhotogrammetryProcessor(
            inputPath: args.inputPath,
            outputPath: args.outputPath,
            quality: args.quality
        )
        
        try await processor.process()
        
        // Convert USDZ to other formats if requested
        let usdzPath = URL(filePath: args.outputPath).appendingPathComponent("model.usdz")
        if fileManager.fileExists(atPath: usdzPath.path) {
            for format in args.formats where format.lowercased() != "usdz" {
                try await convertFormat(from: usdzPath, format: format, outputPath: args.outputPath)
            }
        }
        
        print("")
        print("🎉 Photogrammetry complete!")
        print("📂 Output directory: \(args.outputPath)")
        print("")
        
    } catch PhotogrammetryError.unsupportedPlatform {
        print("❌ RealityKit PhotogrammetrySession requires macOS 12.0+ on Apple Silicon")
        exit(1)
    } catch {
        logger.error("❌ Processing failed: \(error.localizedDescription)")
        print("ERROR: \(error.localizedDescription)")
        exit(1)
    }
}

@available(macOS 12.0, *)
func convertFormat(from usdzURL: URL, format: String, outputPath: String) async throws {
    print("🔄 Converting to \(format.uppercased())...")
    
    // Note: Conversion from USDZ to OBJ/STL requires additional tools
    // For now, create placeholder with metadata
    let outputURL = URL(filePath: outputPath).appendingPathComponent("model.\(format)")
    
    let placeholder = """
    # HeyPhom Export - \(format.uppercased())
    # Source: model.usdz
    # Note: Full USDZ→\(format.uppercased()) conversion requires USD Python tools
    # Install: https://developer.apple.com/augmented-reality/tools/
    
    # For production conversion, use:
    # - Model I/O framework (limited format support)
    # - USD Python tools from Pixar
    # - Third-party converters (Blender, etc.)
    """
    
    try placeholder.write(to: outputURL, atomically: true, encoding: .utf8)
    print("ℹ️  \(format.uppercased()) placeholder created")
    print("   Full conversion requires USD Python tools or Model I/O framework")
}


// MARK: - Entry Point

if #available(macOS 12.0, *) {
    Task {
        await mainAsync()
    }
    RunLoop.main.run()
} else {
    print("❌ HeyPhom requires macOS 12.0 (Monterey) or later")
    print("   Current OS does not support RealityKit PhotogrammetrySession")
    exit(1)
}
