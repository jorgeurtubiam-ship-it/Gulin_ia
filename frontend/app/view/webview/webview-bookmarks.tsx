// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { PrimitiveAtom } from "jotai";

export type BookmarkItem = {
    id: string;
    url: string;
    title: string;
    folder?: string;
    createdAt: number;
};

interface WebviewBookmarksProps {
    isOpenAtom: PrimitiveAtom<boolean>;
    bookmarksAtom: PrimitiveAtom<BookmarkItem[]>;
    currentUrl: string;
    currentTitle: string;
    onNavigate: (url: string) => void;
    onAdd: (bookmark: Omit<BookmarkItem, "id" | "createdAt">) => void;
    onRemove: (id: string) => void;
}

export const WebviewBookmarks = memo(({
    isOpenAtom,
    bookmarksAtom,
    currentUrl,
    currentTitle,
    onNavigate,
    onAdd,
    onRemove,
}: WebviewBookmarksProps) => {
    const [isOpen, setIsOpen] = useAtom(isOpenAtom);
    const bookmarks = useAtomValue(bookmarksAtom);
    const [newTitle, setNewTitle] = useState(currentTitle || currentUrl);
    const [search, setSearch] = useState("");

    if (!isOpen) return null;

    const isCurrentBookmarked = bookmarks.some((b) => b.url === currentUrl);
    const filtered = bookmarks.filter(
        (b) =>
            b.title.toLowerCase().includes(search.toLowerCase()) ||
            b.url.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: "320px",
                height: "100%",
                backgroundColor: "#1c1c1f",
                borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
                boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.4)",
                zIndex: 145,
                display: "flex",
                flexDirection: "column",
                color: "#e6e6e6",
                fontSize: "12px",
            }}
        >
            <div
                style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <span style={{ fontWeight: 600, fontSize: "13px" }}>⭐ Marcadores / Favoritos</span>
                <button
                    onClick={() => setIsOpen(false)}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "#9ca3af",
                        cursor: "pointer",
                        fontSize: "14px",
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Formulario para añadir la página actual */}
            <div
                style={{
                    padding: "10px 14px",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                }}
            >
                <div style={{ marginBottom: "6px", fontWeight: 500 }}>
                    {isCurrentBookmarked ? "✓ Esta página ya está guardada" : "Guardar página actual:"}
                </div>
                {!isCurrentBookmarked ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Nombre del marcador"
                            style={{
                                flex: 1,
                                padding: "4px 8px",
                                backgroundColor: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                borderRadius: "4px",
                                color: "white",
                                fontSize: "11px",
                            }}
                        />
                        <button
                            onClick={() => {
                                onAdd({ url: currentUrl, title: newTitle || currentUrl });
                            }}
                            style={{
                                backgroundColor: "#eab308",
                                color: "#000000",
                                border: "none",
                                borderRadius: "4px",
                                padding: "4px 10px",
                                fontWeight: 600,
                                fontSize: "11px",
                                cursor: "pointer",
                            }}
                        >
                            + Guardar
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => {
                            const b = bookmarks.find((x) => x.url === currentUrl);
                            if (b) onRemove(b.id);
                        }}
                        style={{
                            backgroundColor: "rgba(239, 68, 68, 0.2)",
                            color: "#ef4444",
                            border: "1px solid rgba(239, 68, 68, 0.4)",
                            borderRadius: "4px",
                            padding: "4px 10px",
                            fontSize: "11px",
                            cursor: "pointer",
                        }}
                    >
                        Quitar de marcadores
                    </button>
                )}
            </div>

            <div style={{ padding: "8px 14px" }}>
                <input
                    type="text"
                    placeholder="Buscar marcador..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "6px 10px",
                        backgroundColor: "rgba(255, 255, 255, 0.07)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "6px",
                        color: "white",
                        fontSize: "12px",
                        outline: "none",
                    }}
                />
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px" }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 0", color: "#6b7280" }}>
                        No hay marcadores guardados
                    </div>
                ) : (
                    filtered.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                padding: "8px 10px",
                                borderRadius: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "4px",
                                cursor: "pointer",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                            <div
                                onClick={() => {
                                    onNavigate(item.url);
                                    setIsOpen(false);
                                }}
                                style={{ flex: 1, overflow: "hidden", marginRight: "8px" }}
                            >
                                <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {item.title}
                                </div>
                                <div style={{ fontSize: "11px", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {item.url}
                                </div>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(item.id);
                                }}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#6b7280",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                }}
                                title="Eliminar marcador"
                            >
                                ✕
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

WebviewBookmarks.displayName = "WebviewBookmarks";
