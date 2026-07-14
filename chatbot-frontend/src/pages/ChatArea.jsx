import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Copy } from "lucide-react";
import { CHATBOT_API_URL } from "../config";


export default function ChatArea({
  chat,
  append,
  updateActive,
  setToast,
  toggleSidebar,
  chatId,
}) {
  const [text, setText] = useState("");
  const [hoverIndex, setHoverIndex] = useState(null);
  const bottomRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  if (!chat) return <div className="empty-main" />;

  const send = async () => {
    const m = text.trim();
    if (!m) return;

    const hadNoMessagesBefore =
      !chat.messages || chat.messages.length === 0;

    const wasDefaultTitle =
      chat.title === "New chat" || chat.title.trim() === "";

    // ---------------- USER MESSAGE ----------------
    const user = { role: "user", text: m };
    append(user);
    setText("");

    // Auto rename chat (clean UX)
    try {
      if (
        hadNoMessagesBefore &&
        wasDefaultTitle &&
        typeof updateActive === "function"
      ) {
        const cleanMsg = m.trim().replace(/\s+/g, " ");
        const skipWords = ["hi", "hello", "hey", "hii", "yo", "hola"];
        const firstWord =
          (cleanMsg.split(" ")[0] || "").toLowerCase();

        if (!skipWords.includes(firstWord)) {
          const cap =
            cleanMsg.charAt(0).toUpperCase() +
            cleanMsg.slice(1);

          const titleCandidate =
            cap.length > 25
              ? cap.slice(0, 25).trim() + "..."
              : cap.trim();

          updateActive({ title: titleCandidate });
        }
      }
    } catch (err) {
      console.error("Auto-rename error:", err);
    }

    // Save user message
    try {
      await axios.post(
        `${CHATBOT_API_URL}/api/chat/add-message`,
        {
          chat_id: chatId,
          role: "user",
          text: m,
          chart: null,
        }
      );
    } catch (err) {
      console.error("Save user message error:", err);
    }

    // ---------------- BOT RESPONSE ----------------
    try {
      const res = await axios.post(
        `${CHATBOT_API_URL}/api/chat`,
        { message: m }
      );

      const { summary, chart } = res.data;

      const chartUri = chart
        ? chart.startsWith("data:")
          ? chart
          : `data:image/png;base64,${chart}`
        : null;

      const bot = {
        role: "bot",
        text: summary,
        chart: chartUri,
      };

      append(bot);

      // Save bot message
      await axios.post(
        `${CHATBOT_API_URL}/api/chat/add-message`,
        {
          chat_id: chatId,
          role: "bot",
          text: summary,
          chart: chartUri,
        }
      );
    } catch (err) {
      console.error("API error", err);

      append({
        role: "bot",
        text: "⚠️ Could not connect to the fiscal intelligence server.",
      });

      setToast &&
        setToast({
          text: "Server error",
          type: "error",
        });
    }
  };

  const copyMessage = async (msg) => {
    try {
      await navigator.clipboard.writeText(msg);
      setToast &&
        setToast({
          text: "Message copied",
          type: "success",
        });
    } catch {
      setToast &&
        setToast({
          text: "Copy failed",
          type: "error",
        });
    }
  };

  return (
    <main className="chat-area">
      {/* HEADER */}
      <header className="chat-top">
        <div className="left">
          <div className="brand">
            <a href="/" className="tts" >TTS</a>
          </div>
        </div>
      </header>

      {/* MESSAGES */}
      <section className="chat-messages">
        {!chat.messages || chat.messages.length === 0 ? (
          <div className="empty-state">
            <h1>Where should we begin?</h1>
            <p style={{ opacity: 0.6 }}>
              Ask about GST, Tax Transparency, UTTI, or Budget Allocation
            </p>
          </div>
        ) : (
          chat.messages.map((m, i) => (
            <div
              key={i}
              className={`msg-row ${
                m.role === "user" ? "user" : "bot"
              }`}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {/* Avatar */}
              <div className="avatar">
                {m.role === "user" ? "YOU" : "🤖"}
              </div>

              {/* Bubble */}
              <div className="bubble">
                {/* TEXT */}
                <div
                  className="msg-text"
                  style={{
                    whiteSpace: "pre-line",
                    lineHeight: "1.65",
                    fontSize: "15px",
                  }}
                >
                  {m.text}
                </div>

                {/* COPY BUTTON (BOT ONLY) */}
                {m.role === "bot" && hoverIndex === i && (
                  <button
                    className="bubble-copy"
                    onClick={() => copyMessage(m.text)}
                    title="Copy response"
                  >
                    <Copy size={14} />
                  </button>
                )}

                {/* PROFESSIONAL INLINE CHART CARD */}
                {m.role === "bot" && m.chart && (
                  <div
                    className="inline-chart-card"
                    style={{
                      marginTop: "16px",
                      padding: "16px",
                      borderRadius: "16px",
                      background:
                        "linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%)",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                      
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "16px",
                        marginBottom: "10px",
                        color: "#1e3a8a",
                      }}
                    >
                      📊 Fiscal Allocation Insight
                    </div>

                    <img
                      src={m.chart}
                      alt="Tax Allocation Chart"
                      style={{
                        width: "100%",
                        maxWidth: "520px",
                        borderRadius: "12px",
                        display: "block",
                        margin: "0 auto",
                      }}
                    />

                    <div
                      style={{
                        marginTop: "10px",
                        fontSize: "12px",
                        color: "#64748b",
                        textAlign: "center",
                      }}
                    >
                      Visualization based on proportional Union Budget allocation model (Prototype Fiscal Transparency Engine)
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        <div ref={bottomRef} />
      </section>

      {/* COMPOSER */}
      <footer className="composer">
        <textarea
          rows={1}
          value={text}
          placeholder="Ask about tax, GST, UTTI, or allocation transparency..."
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(
              e.target.scrollHeight,
              120
            )}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="chat-textarea"
        />

        <button className="send" onClick={send}>
          ➤
        </button>
      </footer>
    </main>
  );
}
