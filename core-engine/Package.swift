// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "heyphom-cli",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "heyphom-cli",
            targets: ["heyphom-cli"]
        )
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "heyphom-cli",
            dependencies: [],
            path: "Sources",
            sources: ["main.swift"]
        ),
        .testTarget(
            name: "heyphom-cliTests",
            dependencies: ["heyphom-cli"],
            path: "Tests"
        )
    ]
)
