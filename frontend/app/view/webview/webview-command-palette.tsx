// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo, useState, useEffect } from "react";
import { useAtom } from "jotai";
import { PrimitiveAtom } from "jotai";

export type CommandAction = {
    id: string;
    label: string;
    icon: string;
    description: string;
    action: () => void;
};

interface WebviewCommandPaletteProps {
    isOpenAtom: PrimitiveAtom<boolean>;
    currentUrl: string;
    onNavigate: (url: string) => void;
    onCopyUrl: () => void;
    onOpenDevTools: () => void;
    onToggleReaderMode: () => void;
    onToggleFocusMode: () => void;
    onSendToChat: () => void;
    onToggleDarkMode: () => void;
    onToggleAdblock: () => void;
    onOpenHistory: () => void;
    onOpenBookmarks: () => void;
    onOpenDownloads: () => void;
}

export const WebviewCommandPalette = memo(({
    isOpenAtom,
    currentUrl,
    onNavigate,
    onCopyUrl,
    onOpenDevTools,
    onToggleReaderMode,
    onToggleFocusMode,
    onSendToChat,
    onToggleDarkMode,
    onToggleAdblock,
    onOpenHistory,
    onOpenBookmarks,
    onOpenDownloads,
}: WebviewCommandPaletteProps) => {
    const [isOpen, setIsOpen] = useAtom(isOpenAtom);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    const commands: CommandAction[] = [
        {
            id: "send-to-chat",
            label: "Enviar página actual al Chat de IA",
            icon: "💬",
            description: "Añade la URL al prompt para preguntar a la IA sobre esta página",
            action: onSendToChat,
        },
        {
            id: "reader-mode",
            label: "Modo Lector (Reader Mode)",
            icon: "📖",
            description: "Extrae el artículo limpio sin publicidad ni menús",
            action: onToggleReaderMode,
        },
        {
            id: "focus-mode",
            label: "Focus Mode (Ocultar distracciones)",
            icon: "🌿",
            description: "Oculta cabeceras, pies de página y anuncios",
            action: onToggleFocusMode,
        },
        {
            id: "dark-mode",
            label: "Modo Oscuro Forzado",
            icon: "🌙",
            description: "Invierte colores en sitios que no tienen modo oscuro",
            action: onToggleDarkMode,
        },
        {
            id: "adblock",
            label: "Bloqueador de Anuncios y Trackers",
            icon: "🚫",
            description: "Activar o desactivar el filtrado de publicidad",
            action: onToggleAdblock,
        },
        {
            id: "bookmarks",
            label: "Ver Marcadores / Favoritos",
            icon: "⭐",
            description: "Abrir el panel de marcadores guardados",
            action: onOpenBookmarks,
        },
        {
            id: "history",
            label: "Ver Historial de Navegación",
            icon: "🕒",
            description: "Explorar las páginas visitadas",
            action: onOpenHistory,
        },
        {
            id: "downloads",
            label: "Ver Descargas",
            icon: "📥",
            description: "Abrir el panel de descargas de archivos",
            action: onOpenDownloads,
        },
        {
            id: "copy-url",
            label: "Copiar URL al portapapeles",
            icon: "📋",
            description: currentUrl,
            action: onCopyUrl,
        },
        {
            id: "devtools",
            label: "Abrir / Cerrar Developer Tools",
            icon: "🛠️",
            description: "Inspeccionar consola y red de Chromium",
            action: onOpenDevTools,
        },
    ];

    const filtered = commands.filter(
        (c) =>
            c.label.toLowerCase().includes(query.toLowerCase()) ||
            c.description.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
        }
    }, [isOpen]);

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
                filtered[selectedIndex].action();
                setIsOpen(false);
            } else if (query.startsWith("http://") || query.startsWith("https://") || query.includes(".")) {
                onNavigate(query);
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
                zIndex: 200,
                display: "flex",
                justifyContent: "center",
                paddingTop: "60px",
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "540px",
                    maxHeight: "420px",
                    backgroundColor: "#1e1e22",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "12px",
                    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.7)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    color: "#f3f4f6",
                }}
            >
                <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                    <input
                        type="text"
                        autoFocus
                        placeholder="Escribe un comando o una URL..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "white",
                            fontSize: "14px",
                            fontWeight: 500,
                        }}
                    />
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af" }}>
                            Presiona Enter para navegar a: <strong>{query}</strong>
                        </div>
                    ) : (
                        filtered.map((cmd, idx) => (
                            <div
                                key={cmd.id}
                                onClick={() => {
                                    cmd.action();
                                    setIsOpen(false);
                                }}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "8px",
                                    backgroundColor: idx === selectedIndex ? "rgba(59, 130, 246, 0.25)" : "transparent",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    transition: "background 0.1s",
                                }}
                                onMouseEnter={() => setSelectedIndex(idx)}
                            >
                                <span style={{ fontSize: "16px" }}>{cmd.icon}</span>
                                <div style={{ flex: 1, overflow: "hidden" }}>
                                    <div style={{ fontWeight: 500, fontSize: "13px" }}>{cmd.label}</div>
                                    <div style={{ fontSize: "11px", color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {cmd.description}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div
                    style={{
                        padding: "8px 14px",
                        backgroundColor: "rgba(0, 0, 0, 0.2)",
                        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                        fontSize: "11px",
                        color: "#6b7280",
                        display: "flex",
                        gap: "14px",
                    }}
                >
                    <span>↑↓ Navegar</span>
                    <span>↵ Seleccionar</span>
                    <span>Esc Cerrar</span>
                </div>
            </div>
        </div>
    );
});

WebviewCommandPalette.displayName = "WebviewCommandPalette";
