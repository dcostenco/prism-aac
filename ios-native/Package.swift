// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PrismAAC",
    platforms: [
        .iOS(.v16),
    ],
    products: [
        .library(name: "PrismAAC", targets: ["PrismAAC"]),
    ],
    targets: [
        .target(
            name: "PrismAAC",
            dependencies: ["llama"],
            path: "PrismAAC/Sources",
            resources: [
                .process("Resources"),
            ]
        ),
        .binaryTarget(
            name: "llama",
            path: "llama.xcframework"
        ),
        .testTarget(
            name: "PrismAACTests",
            dependencies: ["PrismAAC"],
            path: "PrismAAC/Tests"
        ),
    ]
)
