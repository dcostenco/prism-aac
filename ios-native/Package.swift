// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PrismAAC",
    platforms: [
        .iOS(.v16),   // A13 Bionic minimum — 4 GB RAM required for 1.5B model
    ],
    products: [
        .library(name: "PrismAAC", targets: ["PrismAAC"]),
    ],
    dependencies: [
        // llama.cpp — Metal-accelerated on-device inference.
        // Pinned to a release that includes the Metal backend fixes for A-series.
        .package(
            url: "https://github.com/ggerganov/llama.cpp",
            revision: "b5396"   // update to latest stable before submission
        ),
    ],
    targets: [
        .target(
            name: "PrismAAC",
            dependencies: [
                .product(name: "llama", package: "llama.cpp"),
            ],
            path: "PrismAAC/Sources",
            resources: [
                .process("../Resources"),
            ]
        ),
        .testTarget(
            name: "PrismAACTests",
            dependencies: ["PrismAAC"],
            path: "PrismAAC/Tests"
        ),
    ]
)
