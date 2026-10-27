// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { PrimitiveAtom } from "jotai";

export type HistoryEntry = {
    url: string;
    title: string;
    visitedAt: number;
    visitCount: number;
};

interface WebHistoryPanelProps {
    isOpenAtom: PrimitiveAtom<boolean>;
    historyAtom: PrimitiveAtom<HistoryEntry[]>;
    onNavigate: (url: string) => void;
    onClear: () => void;
}

export const WebHistoryPanel = memo(({
    isOpenAtom,
    historyAtom,
    onNavigate,
    onClear,
}: WebHistoryPanelProps) => {
    const [isOpen, setIsOpen] = useAtom(isOpenAtom);
    const history = useAtomValue(historyAtom);
    const [search, setSearch] = useState("");

    if (!isOpen) return null;

    const filtered = history.filter(
        (entry) =>
            entry.title.toLowerCase().includes(search.toLowerCase()) ||
            entry.url.toLowerCase().includes(search.toLowerCase())
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
                <span style={{ fontWeight: 600, fontSize: "13px" }}>🕒 Historial de Navegación</span>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={onClear}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "11px",
                        }}
                    >
                        Borrar
                    </button>
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
            </div>

            <div style={{ padding: "8px 14px" }}>
                <input
                    type="text"
                    placeholder="Buscar en el historial..."
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
                        No hay páginas en el historial
                    </div>
                ) : (
                    filtered.map((entry, idx) => (
                        <div
                            key={`${entry.url}-${idx}`}
                            onClick={() => {
                                onNavigate(entry.url);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: "8px 10px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                marginBottom: "4px",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                            <div
                                style={{
                                    fontWeight: 500,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    color: "#f3f4f6",
                                }}
                            >
                                {entry.title || entry.url}
                            </div>
                            <div
                                style={{
                                    fontSize: "11px",
                                    color: "#6b7280",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {entry.url}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

WebHistoryPanel.displayName = "WebHistoryPanel";
