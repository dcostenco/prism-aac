// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PrismAAC",
    platforms: [
        .iOS(.v16),   // A13 Bionic minimum — 4 GB RAM, ~1.6 GB for Q4_K_M 1.7B model
    ],
    products: [
        .library(name: "PrismAAC", targets: ["PrismAAC"]),
    ],
    dependencies: [
        // llama.cpp — Metal-accelerated on-device inference.
        // Local copy at _llama_cpp_local/ — avoids network fetch in CI and Xcode.
        // Source: https://github.com/ggerganov/llama.cpp (revision b5396)
        .package(path: "_llama_cpp_local"),
    ],
    targets: [
        .target(
            name: "PrismAAC",
            dependencies: [
                .product(name: "llama", package: "_llama_cpp_local"),
            ],
            path: "PrismAAC/Sources",
            resources: [
                .process("Resources"),
            ]
        ),
        .testTarget(
            name: "PrismAACTests",
            dependencies: ["PrismAAC"],
            path: "PrismAAC/Tests"
        ),
    ]
)
