// swift-tools-version:5.5

import PackageDescription

let coreSources = [
    "src/llama.cpp",
    "src/llama-vocab.cpp",
    "src/llama-grammar.cpp",
    "src/llama-sampling.cpp",
    "src/unicode.cpp",
    "src/unicode-data.cpp",
    "ggml/src/ggml.c",
    "ggml/src/ggml-alloc.c",
    "ggml/src/ggml-backend.cpp",
    "ggml/src/ggml-quants.c",
    "ggml/src/ggml-aarch64.c",
]

// Exclude Metal files (watchOS simulator ARM64_32 doesn't support int64_t Metal buffers)
// and any other non-source files SPM might auto-process.
let targetExclude = [
    "ggml/src/ggml-metal.metal",
    "ggml/src/ggml-metal.m",
]

var cSettings: [CSetting] = [
    .unsafeFlags(["-Wno-shorten-64-to-32", "-O3", "-DNDEBUG"]),
    .unsafeFlags(["-fno-objc-arc"]),
]

var linkerSettings: [LinkerSetting] = []

#if canImport(Darwin)
linkerSettings.append(.linkedFramework("Accelerate"))
cSettings.append(.define("GGML_USE_ACCELERATE"))
// GGML_USE_METAL intentionally omitted — watchOS uses CPU inference only
#endif

let package = Package(
    name: "llama-watchos",
    platforms: [
        .watchOS(.v4)
    ],
    products: [
        .library(name: "llama-watchos", targets: ["llama-watchos"]),
    ],
    targets: [
        .target(
            name: "llama-watchos",
            path: ".",
            exclude: targetExclude,
            sources: coreSources,
            resources: [],
            publicHeadersPath: "spm-headers",
            cSettings: cSettings,
            linkerSettings: linkerSettings
        ),
    ],
    cxxLanguageStandard: .cxx11
)
