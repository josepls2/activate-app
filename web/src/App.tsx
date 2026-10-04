// Navegación de la app por rol (port ampliado de ContentView.swift).
import { lazy, Suspense, useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  CircleUser,
  Droplet,
  Home,
  Layers,
  LayoutGrid,
  Leaf,
  MessagesSquare,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { asset, availableTabs, routeAllowed, secondaryRoutes, tabLabel, type AppTab } from "./lib/domain";
import { store } from "./lib/store";
import { BackBar, useAppState } from "./ui";
import { LoginView } from "./views/LoginView";
import { HomeView } from "./views/HomeView";

// Cada rol descarga sólo las pantallas que usa.
const SessionsView = lazy(() => import("./views/SessionsView").then((m) => ({ default: m.SessionsView })));
const BookingsView = lazy(() => import("./views/BookingsView").then((m) => ({ default: m.BookingsView })));
const ClientsView = lazy(() => import("./views/ClientsView").then((m) => ({ default: m.ClientsView })));
const AdminView = lazy(() => import("./views/AdminView").then((m) => ({ default: m.AdminView })));
const ChatView = lazy(() => import("./views/ChatView").then((m) => ({ default: m.ChatView })));
const CycleView = lazy(() => import("./views/CycleView").then((m) => ({ default: m.CycleView })));
const NutritionView = lazy(() => import("./views/NutritionView").then((m) => ({ default: m.NutritionView })));
const PlanView = lazy(() => import("./views/PlanView").then((m) => ({ default: m.PlanView })));
const ProfileView = lazy(() => import("./views/ProfileView").then((m) => ({ default: m.ProfileView })));
const ChallengesView = lazy(() => import("./views/ChallengesView").then((m) => ({ default: m.ChallengesView })));
const TipsView = lazy(() => import("./views/TipsView").then((m) => ({ default: m.TipsView })));
const OnboardingView = lazy(() => import("./views/OnboardingView").then((m) => ({ default: m.OnboardingView })));

const tabIcon: Record<AppTab, LucideIcon> = {
  home: Home,
  clients: Users,
  sessions: Calendar,
  bookings: LayoutGrid,
  challenges: Trophy,
  cycle: Droplet,
  chat: MessagesSquare,
  nutrition: Leaf,
  plan: Layers,
  tips: Sparkles,
  admin: UserPlus,
  profile: CircleUser,
};

function readHash(): AppTab | null {
  const value = window.location.hash.replace("#", "") as AppTab;
  return value in tabLabel ? value : null;
}

const fallback = (
  <div className="screen" aria-busy="true">
    <div className="loader" style={{ alignSelf: "center", marginTop: 80 }} />
  </div>
);

export function App() {
  const state = useAppState();

  if (state.authStatus === "checking") {
    return (
      <div className="splash" aria-busy="true">
        <img src={asset("icon-192.png")} alt="" />
        <div className="loader" />
        <span className="caption">Conectando con Activate…</span>
      </div>
    );
  }

  if (!state.currentUser) {
    return (
      <>
        <LoginView />
        <Toast />
      </>
    );
  }

  const user = state.currentUser;
  // Bienvenida del primer acceso para clientes y usuarios de sala.
  if ((user.role === "client" || user.role === "reserve") && (!user.onboarded || !user.termsAccepted)) {
    return (
      <Suspense fallback={fallback}>
        <OnboardingView />
        <Toast />
      </Suspense>
    );
  }

  return <MainView />;
}

function MainView() {
  const state = useAppState();
  const user = state.currentUser;
  const tabs = availableTabs(user);
  const secondary = secondaryRoutes(user);
  const [route, setRoute] = useState<AppTab>(() => {
    const fromHash = readHash();
    return fromHash && routeAllowed(user, fromHash) ? fromHash : (tabs[0] ?? "profile");
  });

  useEffect(() => {
    if (!routeAllowed(user, route)) setRoute(tabs[0] ?? "profile");
  }, [user, route, tabs]);

  useEffect(() => {
    const onHash = () => {
      const next = readHash();
      if (next && routeAllowed(store.getState().currentUser, next)) {
        setRoute(next);
        window.scrollTo({ top: 0 });
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const unread = store.unreadChatCount();
  const pendingCount =
    user?.role === "trainer"
      ? state.bookings.filter((b) => b.status === "pending_trainer" && b.trainerId === user.id).length
      : user?.role === "boss"
        ? state.bookings.filter((b) => b.status === "pending_boss").length
        : 0;

  const select = (tab: AppTab) => {
    setRoute(tab);
    history.replaceState(null, "", `#${tab}`);
    window.scrollTo({ top: 0 });
  };

  const parent = secondary[route];
  const activeTab = tabs.includes(route) ? route : (parent ?? tabs[0]);

  return (
    <div className="app-shell">
      <main>
        {parent && (
          <div className="back-wrap">
            <BackBar label={tabLabel[parent]} onBack={() => select(parent)} />
          </div>
        )}
        <Suspense fallback={fallback}>
          {route === "home" && <HomeView />}
          {route === "clients" && <ClientsView />}
          {route === "sessions" && <SessionsView />}
          {route === "bookings" && <BookingsView />}
          {route === "challenges" && <ChallengesView />}
          {route === "cycle" && <CycleView />}
          {route === "chat" && <ChatView />}
          {route === "nutrition" && <NutritionView />}
          {route === "plan" && <PlanView />}
          {route === "tips" && <TipsView />}
          {route === "admin" && <AdminView />}
          {route === "profile" && <ProfileView />}
        </Suspense>
      </main>

      <nav className="tabbar" aria-label="Secciones">
        <img className="brand" src={asset("activate-logo.png")} alt="Activate" />
        {tabs.map((tab) => {
          const Icon = tabIcon[tab];
          return (
            <button
              key={tab}
              aria-current={activeTab === tab ? "page" : undefined}
              aria-label={tabLabel[tab]}
              onClick={() => select(tab)}
            >
              <span className="tab-icon">
                <Icon size={20} strokeWidth={2.2} />
                {tab === "chat" && unread > 0 && <span className="tab-badge" aria-label={`${unread} sin leer`} />}
                {tab === "bookings" && pendingCount > 0 && (
                  <span className="tab-badge" aria-label={`${pendingCount} pendientes`} />
                )}
              </span>
              {tabLabel[tab]}
              <span className="dot" />
            </button>
          );
        })}
      </nav>
      <Toast />
    </div>
  );
}

function Toast() {
  const { toast } = useAppState();
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <CheckCircle2 size={17} />
      {toast}
    </div>
  );
}
