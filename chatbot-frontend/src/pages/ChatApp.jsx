import React, { useEffect, useState } from "react";
import axios from "axios";
import { CHATBOT_API_URL } from "../config";

import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import Toast from "./Toast";
import SlipEntry from "./SlipEntry";
import "../styles/Chat.css";

export default function ChatApp() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeChart, setActiveChart] = useState(null);
  const [toast, setToast] = useState(null);
  const [viewMode, setViewMode] = useState("chat");

  const userEmail = localStorage.getItem("userEmail");

  // --------------------------------------------------
  // LOAD USER CHATS FROM BACKEND
  // --------------------------------------------------
  useEffect(() => {
    if (!userEmail) return;

    const fetchChats = async () => {
      try {
        const res = await axios.get(
          `${CHATBOT_API_URL}/api/chats/${userEmail}`
        );

        const backendChats = res.data;

        if (backendChats.length === 0) {
          createChat();
        } else {
          setChats(backendChats);
          setActiveChatId(backendChats[0].id);
        }
      } catch (err) {
        console.error("Failed to load chats:", err);
      }
    };

    fetchChats();
  }, [userEmail]);

  // --------------------------------------------------
  // CREATE CHAT
  // --------------------------------------------------
  const createChat = async () => {
    try {
      const res = await axios.post(
        `${CHATBOT_API_URL}/api/chat/create`,
        { email: userEmail }
      );

      const newChat = {
        id: res.data.chat_id,
        title: "New chat",
        messages: [],
      };

      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(newChat.id);
    } catch (err) {
      console.error("Create chat error:", err);
    }
  };

  // --------------------------------------------------
  // DELETE CHAT
  // --------------------------------------------------
  const deleteChat = async (id) => {
    try {
      await axios.delete(
        `${CHATBOT_API_URL}/api/chat/${id}`
      );

      setChats((prev) =>
        prev.filter((c) => c.id !== id)
      );

      if (activeChatId === id) {
        setActiveChatId(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // --------------------------------------------------
  // UPDATE CHAT LOCALLY
  // --------------------------------------------------
  const appendToActive = (message) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              messages: [...(c.messages || []), message],
            }
          : c
      )
    );
  };

  const updateActive = (patch) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? { ...c, ...patch }
          : c
      )
    );
  };

  const activeChat =
    chats.find((c) => c.id === activeChatId) ?? null;

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="app-root">

      {/* Mode Toggle */}
      <div style={{ position: "fixed", top: 10, right: 20, zIndex: 1000 }}>
        <button className="SlipText"
          onClick={() =>
            setViewMode(viewMode === "chat" ? "slip" : "chat")
          }
        >
          {viewMode === "chat"
            ? "Open Slip Entry"
            : "Back to Chatbot"}
        </button>
      </div>

      {viewMode === "slip" ? (
        <SlipEntry />
      ) : (
        <>
          {sidebarVisible && (
            <Sidebar
              chats={chats}
              activeChatId={activeChatId}
              onSelect={(id) => setActiveChatId(id)}
              onNew={createChat}
              onRename={(id, t) =>
                setChats((prev) =>
                  prev.map((c) =>
                    c.id === id
                      ? { ...c, title: t }
                      : c
                  )
                )
              }
              onDelete={deleteChat}
              toggle={() =>
                setSidebarVisible((s) => !s)
              }
              isMobile={window.innerWidth <= 920}
            />
          )}

          <ChatArea
            chat={activeChat}
            chatId={activeChatId}
            append={appendToActive}
            updateActive={updateActive}
            openReview={(chartUri) => {
              setActiveChart(chartUri);
              setReviewOpen(true);
            }}
            setToast={setToast}
            toggleSidebar={() =>
              setSidebarVisible((s) => !s)
            }
          />

          {/* ---------------- CHART PREVIEW ---------------- */}
          {reviewOpen && (
            <>
              <div
                className="review-overlay"
                onClick={() => setReviewOpen(false)}
              />

              <div className="review-split preview-card">
                <div className="preview-header">
                  <h3>Chart Preview</h3>

                  <button
                    className="icon-btn"
                    onClick={() => setReviewOpen(false)}
                  >
                    ✖
                  </button>
                </div>

                <div className="preview-body">
                  {activeChart ? (
                    <img
                      src={activeChart}
                      className="preview-img"
                      alt="chart"
                    />
                  ) : (
                    <div>No chart available</div>
                  )}
                </div>
              </div>
            </>
          )}

          <Toast
            toast={toast}
            onClose={() => setToast(null)}
          />
        </>
      )}
    </div>
  );
}
