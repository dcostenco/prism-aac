import SwiftUI

@main
struct PrismAACApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            Group {
                // Simulator / DEBUG: skip model download, show main UI immediately.
                // The cloud AI path is active — on-device model loads on real device.
                #if DEBUG || targetEnvironment(simulator)
                ContentView()
                    .environmentObject(appState)
                #else
                if appState.modelReady || appState.coreOnlyMode {
                    ContentView()
                        .environmentObject(appState)
                } else {
                    ModelLoadingView()
                        .environmentObject(appState)
                }
                #endif
            }
        }
    }
}
