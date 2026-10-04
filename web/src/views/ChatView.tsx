// Port de ios/CodexGym/Views/ChatView.swift, ampliado: en iOS sólo escribía el
// cliente. Aquí el entrenador tiene bandeja de conversaciones y puede responder.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, CircleUser, Lock, MessagesSquare, Send } from "lucide-react";
import { initials, LIMITS } from "../lib/domain";
import { store } from "../lib/store";
import { EmptyState, ScreenHeader, useAppState } from "../ui";

const timeFormatter = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const SUGGESTIONS = ["¿Cuántas sesiones me quedan?", "¿Cuál es mi próxima sesión?", "Horario del gimnasio"];

function shortWhen(date: Date | null) {
  if (!date) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString() ? timeFormatter.format(date) : dayFormatter.format(date);
}

export function ChatView() {
  const state = useAppState();
  const user = state.currentUser;
  const isClient = user?.role === "client";

  useEffect(() => {
    // El cliente abre siempre su chat; el equipo recupera el último abierto.
    const target = isClient ? user?.id : store.getState().activeChatId;
    if (target) void store.openChat(target);
    return () => store.detachChat();
    // Sólo al entrar/salir de la pestaña o cambiar de cuenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, user?.id]);

  if (isClient) return <Conversation title="Equipo Activate" />;
  if (state.activeChatId) {
    const client = state.managedUsers.find((u) => u.id === state.activeChatId);
    return <Conversation title={client?.name ?? "Cliente"} onBack={() => store.closeChat()} />;
  }
  return <Inbox />;
}

function Inbox() {
  const state = useAppState();
  const names = useMemo(() => new Map(state.managedUsers.map((u) => [u.id, u.name])), [state.managedUsers]);
  const withoutChat = state.managedUsers.filter(
    (u) =>
      u.role === "client" &&
      state.currentUser &&
      u.trainerIds.includes(state.currentUser.id) &&
      !state.chats.some((c) => c.id === u.id),
  );

  return (
    <div className="screen tight">
      <ScreenHeader eyebrow="Equipo" title="Mensajes" subtitle="Conversaciones privadas con tus clientes" />
      {state.chats.length === 0 && withoutChat.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Sin conversaciones"
          message="Cuando un cliente te escriba, aparecerá aquí."
        />
      ) : (
        <div className="form-section">
          {state.chats.map((thread) => {
            const name = names.get(thread.clientId) ?? "Cliente";
            const unread = store.chatHasUnread(thread);
            return (
              <button key={thread.id} className="check-row" onClick={() => void store.openChat(thread.id)}>
                <span className="mini-avatar">{initials(name)}</span>
                <span className="spacer" style={{ minWidth: 0 }}>
                  <span className="row" style={{ gap: 8 }}>
                    <strong className="spacer" style={{ fontSize: 16 }}>
                      {name}
                    </strong>
                    <span className="caption muted">{shortWhen(thread.lastMessageAt)}</span>
                  </span>
                  <span className="caption muted ellipsis" style={{ display: "block", marginTop: 3 }}>
                    {thread.lastMessageText ?? "Sin mensajes todavía"}
                  </span>
                </span>
                {unread && <span className="unread-dot" aria-label="Mensajes nuevos" />}
              </button>
            );
          })}
        </div>
      )}

      {withoutChat.length > 0 && (
        <>
          <h2 className="section-title">Escribir a</h2>
          <div className="chips" style={{ padding: 0, flexWrap: "wrap" }}>
            {withoutChat.map((client) => (
              <button key={client.id} className="chip" onClick={() => void store.openChat(client.id)}>
                {client.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Conversation({ title, onBack }: { title: string; onBack?: () => void }) {
  const state = useAppState();
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const isClient = state.currentUser?.role === "client";

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [state.messages.length]);

  const send = (value: string) => {
    if (!value.trim()) return;
    void store.sendMessage(value);
    setText("");
  };

  return (
    <div className="chat">
      <div className="chat-head">
        {onBack && (
          <button className="icon-btn" onClick={onBack} aria-label="Volver a mensajes">
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="chat-avatar">
          <CircleUser size={24} />
        </div>
        <div className="spacer">
          <div className="bold">{title}</div>
          <div className="inline-icon muted" style={{ fontSize: 11, marginTop: 3 }}>
            <Lock size={10} /> Conversación privada
          </div>
        </div>
      </div>

      <div className="chat-log" ref={logRef} aria-live="polite">
        {state.chatError && (
          <div className="error-box" role="alert">
            <AlertTriangle size={16} style={{ flex: "none" }} />
            {state.chatError}
          </div>
        )}
        {state.messages.length === 0 && !state.chatError && (
          <p className="muted caption" style={{ textAlign: "center", marginTop: 12 }}>
            {isClient ? "Escribe a tu equipo de entrenadores. Te responderán por aquí." : "Todavía no hay mensajes."}
          </p>
        )}
        {state.messages.map((m) => {
          const mine = m.author === "user";
          return (
            <div key={m.id} className={`bubble-row${mine ? " mine" : ""}`}>
              <div className="bubble-wrap">
                <div className="bubble">{m.text}</div>
                <span className="bubble-time">
                  {m.timestamp.toDateString() === new Date().toDateString()
                    ? timeFormatter.format(m.timestamp)
                    : `${dayFormatter.format(m.timestamp)} · ${timeFormatter.format(m.timestamp)}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {isClient && (
        <div className="chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <textarea
          rows={1}
          placeholder="Escribe un mensaje…"
          aria-label="Mensaje"
          value={text}
          maxLength={LIMITS.message}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
        />
        <button className="send-btn" type="submit" aria-label="Enviar mensaje" disabled={!text.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
