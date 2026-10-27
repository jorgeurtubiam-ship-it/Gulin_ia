// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { PrimitiveAtom } from "jotai";

export type ReadingListItem = {
    id: string;
    url: string;
    title: string;
    excerpt?: string;
    savedAt: number;
    isRead: boolean;
};

interface ReadingListProps {
    isOpenAtom: PrimitiveAtom<boolean>;
    itemsAtom: PrimitiveAtom<ReadingListItem[]>;
    onNavigate: (url: string) => void;
    onToggleRead: (id: string) => void;
    onRemove: (id: string) => void;
}

export const ReadingList = memo(({
    isOpenAtom,
    itemsAtom,
    onNavigate,
    onToggleRead,
    onRemove,
}: ReadingListProps) => {
    const [isOpen, setIsOpen] = useAtom(isOpenAtom);
    const items = useAtomValue(itemsAtom);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "320px",
                height: "100%",
                backgroundColor: "#1c1c1f",
                borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                boxShadow: "4px 0 20px rgba(0, 0, 0, 0.4)",
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
                <span style={{ fontWeight: 600, fontSize: "13px" }}>📚 Lista de Lectura ({items.length})</span>
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

            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                {items.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 0", color: "#6b7280" }}>
                        No hay artículos guardados para leer
                    </div>
                ) : (
                    items.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                padding: "8px 10px",
                                borderRadius: "6px",
                                marginBottom: "6px",
                                backgroundColor: item.isRead ? "transparent" : "rgba(59, 130, 246, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.06)",
                            }}
                        >
                            <div
                                onClick={() => {
                                    onNavigate(item.url);
                                    setIsOpen(false);
                                }}
                                style={{
                                    fontWeight: item.isRead ? 400 : 600,
                                    cursor: "pointer",
                                    color: item.isRead ? "#9ca3af" : "#f3f4f6",
                                    marginBottom: "4px",
                                }}
                            >
                                {!item.isRead && <span style={{ color: "#3b82f6", marginRight: "4px" }}>●</span>}
                                {item.title}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "10px", color: "#6b7280" }}>
                                    {new Date(item.savedAt).toLocaleDateString()}
                                </span>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                        onClick={() => onToggleRead(item.id)}
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            color: "#60a5fa",
                                            cursor: "pointer",
                                            fontSize: "11px",
                                        }}
                                    >
                                        {item.isRead ? "Marcar no leído" : "Marcar leído"}
                                    </button>
                                    <button
                                        onClick={() => onRemove(item.id)}
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            color: "#ef4444",
                                            cursor: "pointer",
                                            fontSize: "11px",
                                        }}
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

ReadingList.displayName = "ReadingList";
