import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, MoreVertical, X, Menu } from "lucide-react";

export default function Sidebar({
  chats = [],
  activeChatId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [temp, setTemp] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 900);
      if (window.innerWidth > 900) {
        setCollapsed(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => !prev);
  };

  const username = localStorage.getItem("username") || "User";
  const avatarLetter = username.charAt(0).toUpperCase();

  const openMenuFor = (id) =>
    setMenuOpen((p) => (p === id ? null : id));

  const startEdit = (id, title) => {
    setEditing(id);
    setTemp(title);
    setMenuOpen(null);
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobile && !collapsed && (
        <div
          className="sidebar-backdrop"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        className={`sidebar-panel ${
          collapsed ? "collapsed" : ""
        } ${isMobile ? "mobile" : ""}`}
      >
        <div className="sidebar-header">
          {!collapsed && (
            <button className="new-chat" onClick={onNew}>
              <Plus size={14} /> New chat
            </button>
          )}

          <button className="close-sidebar" onClick={toggleSidebar}>
            {collapsed ? <Menu size={18} /> : <X size={18} />}
          </button>
        </div>

        {!collapsed && (
          <nav className="sidebar-list">
            {chats.map((c) => {
              const active = c.id === activeChatId;

              return (
                <div
                  key={c.id}
                  className={`sidebar-item ${active ? "active" : ""}`}
                  onClick={() => onSelect(c.id)}
                >
                  <div className="left">
                    <div className="dot" />

                    {editing === c.id ? (
                      <input
                        className="rename-input"
                        autoFocus
                        value={temp}
                        onChange={(e) => setTemp(e.target.value)}
                        onBlur={() => {
                          onRename(c.id, temp || "New chat");
                          setEditing(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onRename(c.id, temp || "New chat");
                            setEditing(null);
                          }
                        }}
                      />
                    ) : (
                      <div className="title">{c.title}</div>
                    )}
                  </div>

                  <div
                    className="right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="icon"
                      onClick={() => openMenuFor(c.id)}
                    >
                      <MoreVertical size={16} />
                    </button>

                    {menuOpen === c.id && (
                      <div className="menu-pop">
                        <button
                          className="menu-item"
                          onClick={() =>
                            startEdit(c.id, c.title)
                          }
                        >
                          <Edit2 size={14} /> Rename
                        </button>

                        <button
                          className="menu-item danger"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Delete this chat?"
                              )
                            )
                              onDelete(c.id);
                            setMenuOpen(null);
                          }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </nav>
        )}

        {!collapsed && (
          <div className="sidebar-footer">
            <div className="avatar">
              {avatarLetter}
            </div>
            <div className="acct">
              <div className="name">{username}</div>
              <div className="sub">Logged In</div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}