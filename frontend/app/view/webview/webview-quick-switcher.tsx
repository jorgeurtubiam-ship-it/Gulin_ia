// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo, useState, useEffect } from "react";
import { useAtom } from "jotai";
import { PrimitiveAtom } from "jotai";

export type SwitcherItem = {
    type: "tab" | "history" | "bookmark";
    id: string;
    url: string;
    title: string;
};

interface WebviewQuickSwitcherProps {
    isOpenAtom: PrimitiveAtom<boolean>;
    items: SwitcherItem[];
    onSelect: (item: SwitcherItem) => void;
}

export const WebviewQuickSwitcher = memo(({
    isOpenAtom,
    items,
    onSelect,
}: WebviewQuickSwitcherProps) => {
    const [isOpen, setIsOpen] = useAtom(isOpenAtom);
    const [search, setSearch] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filtered = items.filter(
        (i) =>
            i.title.toLowerCase().includes(search.toLowerCase()) ||
            i.url.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        setSelectedIndex(0);
    }, [search]);

    if (!isOpen) return null;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsOpen(false);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[selectedIndex]) {
                onSelect(filtered[selectedIndex]);
                setIsOpen(false);
            }
        }
    };

    return (
        <div
            onClick={() => setIsOpen(false)}
            style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(2px)",
                zIndex: 210,
                display: "flex",
                justifyContent: "center",
                paddingTop: "70px",
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "500px",
                    maxHeight: "380px",
                    backgroundColor: "#1c1c1f",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "10px",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    color: "#f3f4f6",
                }}
            >
                <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                    <input
                        type="text"
                        autoFocus
                        placeholder="Cambiar rápido (Tabs, Historial, Favoritos)..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "white",
                            fontSize: "13px",
                        }}
                    />
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "4px" }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#6b7280", fontSize: "12px" }}>
                            No se encontraron resultados
                        </div>
                    ) : (
                        filtered.map((item, idx) => {
                            const icon = item.type === "tab" ? "🗂️" : item.type === "bookmark" ? "⭐" : "🕒";
                            return (
                                <div
                                    key={`${item.type}-${item.id}-${idx}`}
                                    onClick={() => {
                                        onSelect(item);
                                        setIsOpen(false);
                                    }}
                                    style={{
                                        padding: "6px 10px",
                                        borderRadius: "6px",
                                        backgroundColor: idx === selectedIndex ? "rgba(59, 130, 246, 0.2)" : "transparent",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        fontSize: "12px",
                                    }}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                >
                                    <span>{icon}</span>
                                    <div style={{ flex: 1, overflow: "hidden" }}>
                                        <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {item.title || item.url}
                                        </div>
                                        <div style={{ fontSize: "10px", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {item.url}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
});

WebviewQuickSwitcher.displayName = "WebviewQuickSwitcher";
