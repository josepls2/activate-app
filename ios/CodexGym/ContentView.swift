import SwiftUI

/// Vista raíz de la aplicación. Decide si debe mostrar el acceso o la
/// navegación principal según el estado de autenticación.
struct ContentView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        Group {
            if store.currentUser == nil {
                LoginView()
            } else {
                MainView()
            }
        }
        .background(T.background.ignoresSafeArea())
        .animation(.easeInOut(duration: 0.25), value: store.currentUser?.id)
    }
}

/// Contenedor principal de todas las vistas disponibles para la cuenta.
struct MainView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selectedTab: AppTab = .sessions

    var body: some View {
        Group {
            switch selectedTab {
            case .clients:
                ClientsView()
            case .sessions:
                SessionsView()
            case .bookings:
                BookingsView()
            case .cycle:
                CycleView()
            case .chat:
                ChatView()
            case .nutrition:
                NutritionView()
            case .plan:
                PlanView()
            case .admin:
                AdminView()
            case .profile:
                ProfileView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            BottomTabBar(selectedTab: $selectedTab, tabs: store.availableTabs)
        }
        .background(T.background.ignoresSafeArea())
        .overlay(alignment: .top) {
            if let toast = store.toast {
                ToastView(text: toast)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .task {
                        try? await Task.sleep(for: .seconds(2.2))
                        if store.toast == toast {
                            withAnimation { store.toast = nil }
                        }
                    }
            }
        }
        .onAppear {
            selectedTab = store.availableTabs.first ?? .profile
        }
        .onChange(of: store.availableTabs) { _, tabs in
            if !tabs.contains(selectedTab) {
                selectedTab = tabs.first ?? .profile
            }
        }
    }
}

struct BottomTabBar: View {
    @Binding var selectedTab: AppTab
    let tabs: [AppTab]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs) { tab in
                Button {
                    withAnimation(.easeOut(duration: 0.18)) {
                        selectedTab = tab
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 18, weight: .semibold))
                        Text(tab.label)
                            .font(.system(size: 9, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                        Circle()
                            .fill(selectedTab == tab ? T.red : .clear)
                            .frame(width: 4, height: 4)
                    }
                    .foregroundStyle(selectedTab == tab ? T.redLight : T.muted)
                    .frame(maxWidth: .infinity)
                    .frame(height: 58)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.label)
                .accessibilityAddTraits(selectedTab == tab ? .isSelected : [])
            }
        }
        .padding(.top, 4)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle().fill(T.border).frame(height: 1)
        }
    }
}

struct ToastView: View {
    let text: String

    var body: some View {
        Label(text, systemImage: "checkmark.circle.fill")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(T.text)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
            .clipShape(Capsule())
            .overlay { Capsule().stroke(T.green.opacity(0.5)) }
            .shadow(color: .black.opacity(0.4), radius: 18, y: 8)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            ContentView()
                .environmentObject(AppStore())
                .previewDisplayName("iPhone pequeño")
                .previewDevice("iPhone SE (3rd generation)")

            ContentView()
                .environmentObject(AppStore())
                .previewDisplayName("iPhone grande")
                .previewDevice("iPhone 17 Pro Max")
        }
    }
}
