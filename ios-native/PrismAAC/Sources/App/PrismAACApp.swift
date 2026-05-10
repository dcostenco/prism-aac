import SwiftUI

@main
struct PrismAACApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            Group {
                if appState.modelReady || appState.coreOnlyMode {
                    ContentView()
                        .environmentObject(appState)
                } else {
                    ModelLoadingView()
                        .environmentObject(appState)
                }
            }
        }
    }
}
