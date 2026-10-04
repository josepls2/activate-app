// Mensajería tipo WhatsApp entre cada cliente y sus entrenadores.
// Un chat por cliente (id = uid del cliente) con todos sus entrenadores
// asignados: el cliente escribe a «su equipo» y cualquiera de ellos responde.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock3,
  Copy,
  IdCard,
  Lock,
  MessagesSquare,
  Reply,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { initials, LIMITS, type AppUser, type ChatMessage, type ChatThread } from "../lib/domain";
import { store } from "../lib/store";
import { EmptyState, ScreenHeader, useAppState } from "../ui";
import { ClientDetailSheet } from "./ClientsView";

const timeFormatter = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const longDayFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
const weekdayFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "long" });

const CLIENT_SUGGESTIONS = ["¿Cuántas sesiones me quedan?", "¿Podemos cambiar mi próxima sesión?", "Hoy no podré venir"];
const STAFF_QUICK_REPLIES = [
  "¡Buen entreno hoy! 💪",
  "¿Cómo te encuentras después de la sesión?",
  "Recuerda tu sesión de mañana 🙂",
  "¿Te va bien la misma hora la semana que viene?",
  "Recuerda hidratarte y descansar bien",
];

const DAY_MS = 86_400_000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** «Hoy», «Ayer», «martes» (esta semana) o «12 sept». */
function shortWhen(date: Date | null) {
  if (!date) return "";
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
  if (diff === 0) return timeFormatter.format(date);
  if (diff === 1) return "Ayer";
  if (diff < 7) return weekdayFormatter.format(date);
  return dayFormatter.format(date);
}

function dayLabel(date: Date) {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return longDayFormatter.format(date);
}

/** Nombres de todas las personas que pueden aparecer en un chat. */
function useNames() {
  const state = useAppState();
  return useMemo(() => {
    const names = new Map<string, string>();
    for (const s of state.staff) if (s.authUid) names.set(s.authUid, s.name);
    for (const u of [...state.trainers, ...state.managedUsers]) names.set(u.id, u.name);
    if (state.currentUser) names.set(state.currentUser.id, state.currentUser.name);
    return names;
  }, [state.staff, state.trainers, state.managedUsers, state.currentUser]);
}

/** ✓✓ azul cuando alguien más del chat lo ha visto. */
function readByOthers(thread: ChatThread | null, viewerId: string, at: Date) {
  if (!thread) return false;
  return Object.entries(thread.readBy).some(([uid, date]) => uid !== viewerId && date.getTime() >= at.getTime());
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

  if (isClient) return <Conversation />;
  if (state.activeChatId) return <Conversation onBack={() => store.closeChat()} />;
  return <Inbox />;
}

type InboxRow = { client: AppUser | null; clientId: string; name: string; thread: ChatThread | null };

function Inbox() {
  const state = useAppState();
  const me = state.currentUser!;
  const [queryText, setQueryText] = useState("");

  const rows = useMemo<InboxRow[]>(() => {
    const byId = new Map(state.managedUsers.map((u) => [u.id, u]));
    const list: InboxRow[] = state.chats.map((thread) => {
      const client = byId.get(thread.clientId) ?? null;
      return { client, clientId: thread.clientId, name: client?.name ?? "Cliente", thread };
    });
    // Clientes asignados que todavía no tienen conversación: se puede empezar una.
    for (const client of state.managedUsers) {
      if (client.role !== "client" || !client.trainerIds.includes(me.id)) continue;
      if (state.chats.some((c) => c.clientId === client.id)) continue;
      list.push({ client, clientId: client.id, name: client.name, thread: null });
    }
    return list.sort((a, b) => {
      const at = a.thread?.lastMessageAt?.getTime() ?? 0;
      const bt = b.thread?.lastMessageAt?.getTime() ?? 0;
      return bt - at || a.name.localeCompare(b.name, "es");
    });
  }, [state.chats, state.managedUsers, me.id]);

  const needle = queryText.trim().toLocaleLowerCase("es");
  const visible = needle ? rows.filter((r) => r.name.toLocaleLowerCase("es").includes(needle)) : rows;
  const unreadTotal = rows.filter((r) => r.thread && store.chatHasUnread(r.thread)).length;

  return (
    <div className="screen tight">
      <ScreenHeader
        eyebrow="Equipo"
        title="Chats"
        subtitle={unreadTotal ? `${unreadTotal} ${unreadTotal === 1 ? "conversación" : "conversaciones"} sin leer` : "Habla con tus clientes"}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Sin conversaciones"
          message="Cuando tengas clientes asignados podrás escribirles desde aquí."
        />
      ) : (
        <>
          <label className="search-field">
            <Search size={16} />
            <input
              type="search"
              placeholder="Buscar cliente"
              aria-label="Buscar cliente"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
          </label>
          <div className="chat-list">
            {visible.map((row) => (
              <InboxItem key={row.clientId} row={row} viewerId={me.id} />
            ))}
            {visible.length === 0 && <p className="caption muted chat-list-empty">Ningún cliente coincide.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function InboxItem({ row, viewerId }: { row: InboxRow; viewerId: string }) {
  const { thread } = row;
  const unread = thread ? store.chatHasUnread(thread) : false;
  const mineLast = thread?.lastAuthorId === viewerId;
  const seen = mineLast && thread?.lastMessageAt ? readByOthers(thread, viewerId, thread.lastMessageAt) : false;

  return (
    <button className={`chat-item${unread ? " unread" : ""}`} onClick={() => void store.openChat(row.clientId)}>
      <span className="mini-avatar">{initials(row.name)}</span>
      <span className="chat-item-body">
        <span className="chat-item-top">
          <strong className="ellipsis">{row.name}</strong>
          <span className="chat-item-time">{shortWhen(thread?.lastMessageAt ?? null)}</span>
        </span>
        <span className="chat-item-bottom">
          <span className="ellipsis chat-item-preview">
            {thread?.lastMessageText ? (
              <>
                {mineLast && (
                  <span className={`tick${seen ? " seen" : ""}`}>
                    {seen ? <CheckCheck size={15} /> : <Check size={15} />}
                  </span>
                )}
                {thread.lastMessageText}
              </>
            ) : (
              <span className="muted">Toca para empezar a hablar</span>
            )}
          </span>
          {unread && <span className="unread-dot" aria-label="Mensajes nuevos" />}
        </span>
      </span>
    </button>
  );
}

function Conversation({ onBack }: { onBack?: () => void }) {
  const state = useAppState();
  const me = state.currentUser!;
  const isClient = me.role === "client";
  const names = useNames();
  const chatId = state.activeChatId ?? (isClient ? me.id : null);
  const thread = store.threadFor(chatId);
  const client = isClient ? me : state.managedUsers.find((u) => u.id === chatId) ?? null;

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showFicha, setShowFicha] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const coarse = useMemo(() => window.matchMedia?.("(pointer: coarse)").matches ?? false, []);

  // Equipo del cliente: los demás participantes del chat (o sus entrenadores).
  const teamIds = (thread?.participantIds ?? [client?.id ?? "", ...(client?.trainerIds ?? [])]).filter(
    (id) => id && id !== client?.id,
  );
  const teamNames = teamIds.map((id) => names.get(id)).filter(Boolean) as string[];
  const title = isClient ? (teamNames.length === 1 ? teamNames[0] : "Tu equipo Activate") : (client?.name ?? "Cliente");
  const subtitle = isClient
    ? teamNames.length > 1
      ? teamNames.join(", ")
      : "Tu entrenador"
    : teamNames.length > 1
      ? `Con ${teamNames.filter((n) => n !== me.name).join(", ")}`
      : "Conversación privada";

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [state.messages.length]);

  // Ajusta la altura del cuadro de texto al contenido (hasta 5 líneas).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  const send = (value: string) => {
    if (!value.trim()) return;
    void store.sendMessage(value, replyTo);
    setText("");
    setReplyTo(null);
    inputRef.current?.focus();
  };

  const startReply = (message: ChatMessage) => {
    setReplyTo(message);
    setSelected(null);
    inputRef.current?.focus();
  };

  const authorName = (authorId: string) => (authorId === me.id ? "Tú" : (names.get(authorId) ?? "Activate"));
  const showAuthors = teamIds.length > 1 || !isClient;

  return (
    <div className="chat">
      <div className="chat-head">
        {onBack && (
          <button className="icon-btn" onClick={onBack} aria-label="Volver a los chats">
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="chat-avatar">{isClient && teamNames.length > 1 ? <Users size={20} /> : initials(title)}</div>
        <div className="spacer" style={{ minWidth: 0 }}>
          <div className="bold ellipsis">{title}</div>
          <div className="inline-icon muted ellipsis" style={{ fontSize: 12, marginTop: 2 }}>
            <Lock size={10} /> {subtitle}
          </div>
        </div>
        {!isClient && client && (
          <button className="chat-head-action" onClick={() => setShowFicha(true)} aria-label="Ver ficha del cliente">
            <IdCard size={18} />
            <span>Ficha</span>
          </button>
        )}
      </div>

      <div className="chat-log" ref={logRef} aria-live="polite" onClick={() => setSelected(null)}>
        {state.chatError && (
          <div className="error-box" role="alert">
            <AlertTriangle size={16} style={{ flex: "none" }} />
            {state.chatError}
          </div>
        )}
        <div className="chat-notice">
          <Lock size={11} /> Sólo {isClient ? "tú y tu equipo" : `${client?.name.split(" ")[0] ?? "el cliente"} y su equipo`} podéis leer esta conversación.
        </div>
        {state.messages.length === 0 && !state.chatError && (
          <p className="muted caption" style={{ textAlign: "center" }}>
            {isClient
              ? "Escribe a tu entrenador: dudas, cambios de hora, cómo te encuentras…"
              : "Todavía no hay mensajes. ¡Rompe el hielo!"}
          </p>
        )}
        {state.messages.map((m, index) => {
          const prev = state.messages[index - 1];
          const newDay = !prev || startOfDay(prev.timestamp) !== startOfDay(m.timestamp);
          const grouped = !newDay && prev?.authorId === m.authorId && m.timestamp.getTime() - prev.timestamp.getTime() < 5 * 60_000;
          const mine = m.author === "user";
          const isSelected = selected === m.id;
          const seen = mine && readByOthers(thread, me.id, m.timestamp);
          return (
            <Fragment key={m.id}>
              {newDay && <div className="day-chip">{dayLabel(m.timestamp)}</div>}
              <div className={`bubble-row${mine ? " mine" : ""}${grouped ? " grouped" : ""}`}>
                <div className="bubble-wrap">
                  <button
                    type="button"
                    className={`bubble${m.deleted ? " deleted" : ""}${isSelected ? " selected" : ""}`}
                    aria-label={m.deleted ? "Mensaje eliminado" : "Opciones del mensaje"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!m.deleted) setSelected(isSelected ? null : m.id);
                    }}
                    onDoubleClick={() => !m.deleted && startReply(m)}
                  >
                    {!mine && showAuthors && !grouped && <span className="bubble-author">{authorName(m.authorId)}</span>}
                    {m.replyTo && !m.deleted && (
                      <span className="bubble-quote">
                        <strong>{authorName(m.replyTo.authorId)}</strong>
                        <span>{m.replyTo.text}</span>
                      </span>
                    )}
                    {m.deleted ? (
                      <span className="inline-icon">
                        <Ban size={13} /> {mine ? "Eliminaste este mensaje" : "Mensaje eliminado"}
                      </span>
                    ) : (
                      <span className="bubble-text">{m.text}</span>
                    )}
                    <span className="bubble-meta">
                      {timeFormatter.format(m.timestamp)}
                      {mine &&
                        !m.deleted &&
                        (m.pending ? (
                          <Clock3 size={12} aria-label="Enviando" />
                        ) : seen ? (
                          <CheckCheck size={14} className="seen" aria-label="Leído" />
                        ) : (
                          <Check size={14} aria-label="Enviado" />
                        ))}
                    </span>
                  </button>
                  {isSelected && (
                    <div className="bubble-actions" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => startReply(m)}>
                        <Reply size={14} /> Responder
                      </button>
                      <button
                        onClick={() => {
                          void navigator.clipboard?.writeText(m.text).then(
                            () => store.showToast("Mensaje copiado"),
                            () => undefined,
                          );
                          setSelected(null);
                        }}
                      >
                        <Copy size={14} /> Copiar
                      </button>
                      {store.canDeleteMessage(m) && (
                        <button
                          className="danger"
                          onClick={() => {
                            void store.deleteMessage(m);
                            setSelected(null);
                          }}
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {!text && !replyTo && (
        <div className="chips chat-quick">
          {(isClient ? (state.messages.length === 0 ? CLIENT_SUGGESTIONS : []) : STAFF_QUICK_REPLIES).map((s) => (
            <button key={s} className="chip" onClick={() => (isClient ? send(s) : setText(s))}>
              {s}
            </button>
          ))}
        </div>
      )}

      {replyTo && (
        <div className="reply-bar">
          <Reply size={16} className="muted" />
          <div className="spacer" style={{ minWidth: 0 }}>
            <strong>{authorName(replyTo.authorId)}</strong>
            <span className="ellipsis">{replyTo.text}</span>
          </div>
          <button className="icon-btn" style={{ margin: 0 }} onClick={() => setReplyTo(null)} aria-label="Cancelar respuesta">
            <X size={18} />
          </button>
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
          ref={inputRef}
          rows={1}
          placeholder="Mensaje"
          aria-label="Mensaje"
          value={text}
          maxLength={LIMITS.message}
          enterKeyHint={coarse ? "enter" : "send"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // En ordenador Intro envía (Mayús+Intro, salto de línea); en el móvil, el botón.
            if (e.key === "Enter" && !e.shiftKey && !coarse) {
              e.preventDefault();
              send(text);
            }
          }}
        />
        <button className="send-btn" type="submit" aria-label="Enviar mensaje" disabled={!text.trim()}>
          <Send size={18} />
        </button>
      </form>

      {showFicha && client && <ClientDetailSheet client={client} onClose={() => setShowFicha(false)} />}
    </div>
  );
}
