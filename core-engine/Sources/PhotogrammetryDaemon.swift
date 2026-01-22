import Foundation
import Network
import RealityKit
import os.log

// MARK: - Photogrammetry Daemon Server
// Runs continuously, accepts job requests via Unix socket
// Pre-warmed RealityKit framework for faster job start

let logger = Logger(subsystem: "com.heyphom.daemon", category: "server")

@available(macOS 12.0, *)
class PhotogrammetryDaemon {
    private let socketPath: String
    private var listener: NWListener?
    private var activeJobs: [String: PhotogrammetryProcessor] = [:]
    
    init(socketPath: String = "/tmp/heyphom-daemon.sock") {
        self.socketPath = socketPath
    }
    
    func start() throws {
        // Remove existing socket
        try? FileManager.default.removeItem(atPath: socketPath)
        
        // Create Unix domain socket listener
        let endpoint = NWEndpoint.unix(path: socketPath)
        let parameters = NWParameters()
        
        listener = try NWListener(using: parameters, on: .init(integerLiteral: 0))
        
        listener?.newConnectionHandler = { [weak self] connection in
            self?.handleConnection(connection)
        }
        
        listener?.stateUpdateHandler = { state in
            switch state {
            case .ready:
                logger.info("✅ Daemon listening on \(self.socketPath)")
                print("✅ HeyPhom Photogrammetry Daemon ready")
                print("📍 Socket: \(self.socketPath)")
                fflush(stdout)
            case .failed(let error):
                logger.error("❌ Daemon failed: \(error.localizedDescription)")
            default:
                break
            }
        }
        
        listener?.start(queue: .main)
        
        // Keep daemon running
        RunLoop.main.run()
    }
    
    private func handleConnection(_ connection: NWConnection) {
        connection.start(queue: .global())
        
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            guard let data = data, let self = self else { return }
            
            if let request = try? JSONDecoder().decode(JobRequest.self, from: data) {
                Task {
                    await self.processJob(request, connection: connection)
                }
            }
            
            if isComplete {
                connection.cancel()
            }
        }
    }
    
    private func processJob(_ request: JobRequest, connection: NWConnection) async {
        logger.info("🔄 Processing job: \(request.sessionId)")
        
        do {
            let processor = try PhotogrammetryProcessor(
                inputPath: request.inputPath,
                outputPath: request.outputPath,
                quality: request.quality
            )
            
            activeJobs[request.sessionId] = processor
            
            // Process with progress callback
            try await processor.process(formats: request.formats) { progress in
                // Send progress via socket
                let response = JobProgress(
                    sessionId: request.sessionId,
                    progress: progress.percentage,
                    stage: progress.stage
                )
                
                if let data = try? JSONEncoder().encode(response) {
                    connection.send(content: data, completion: .idempotent)
                }
            }
            
            // Send completion
            let completion = JobCompletion(
                sessionId: request.sessionId,
                status: "completed",
                results: processor.results
            )
            
            if let data = try? JSONEncoder().encode(completion) {
                connection.send(content: data, completion: .idempotent)
            }
            
            activeJobs.removeValue(forKey: request.sessionId)
            
        } catch {
            logger.error("❌ Job failed: \(error.localizedDescription)")
            
            let failure = JobCompletion(
                sessionId: request.sessionId,
                status: "failed",
                error: error.localizedDescription
            )
            
            if let data = try? JSONEncoder().encode(failure) {
                connection.send(content: data, completion: .idempotent)
            }
        }
    }
    
    func stop() {
        listener?.cancel()
        try? FileManager.default.removeItem(atPath: socketPath)
    }
}

// MARK: - Message Types

struct JobRequest: Codable {
    let sessionId: String
    let inputPath: String
    let outputPath: String
    let quality: String
    let formats: [String]
}

struct JobProgress: Codable {
    let sessionId: String
    let progress: Int
    let stage: String
}

struct JobCompletion: Codable {
    let sessionId: String
    let status: String
    let results: [String: FileResult]?
    let error: String?
    
    init(sessionId: String, status: String, results: [String: FileResult]? = nil, error: String? = nil) {
        self.sessionId = sessionId
        self.status = status
        self.results = results
        self.error = error
    }
}

struct FileResult: Codable {
    let filename: String
    let path: String
    let size: Int64
}

// MARK: - Main Entry Point

@available(macOS 12.0, *)
@main
struct DaemonMain {
    static func main() throws {
        print("🚀 Starting HeyPhom Photogrammetry Daemon...")
        
        let daemon = PhotogrammetryDaemon()
        try daemon.start()
    }
}
