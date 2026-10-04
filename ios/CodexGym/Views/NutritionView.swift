import SwiftUI

struct NutritionView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(
                    eyebrow: store.currentUser?.role.label ?? "",
                    title: "Nutrición",
                    subtitle: "Plan publicado por tu profesional"
                )

                ContentUnavailableView(
                    "Sin plan publicado",
                    systemImage: "leaf",
                    description: Text(
                        "Cuando tu profesional publique un plan nutricional " +
                        "en Firebase aparecerá aquí."
                    )
                )
                .frame(maxWidth: .infinity, minHeight: 320)
                .gymCard()
            }
            .padding(20)
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
    }
}
