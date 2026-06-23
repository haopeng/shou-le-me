// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "SlimYetCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "SlimYetCore", targets: ["SlimYetCore"])
    ],
    targets: [
        .target(
            name: "SlimYetCore",
            path: "Shared/SlimYetCore/Sources/SlimYetCore"
        ),
        .testTarget(
            name: "SlimYetCoreTests",
            dependencies: ["SlimYetCore"],
            path: "Shared/SlimYetCore/Tests/SlimYetCoreTests"
        )
    ]
)
