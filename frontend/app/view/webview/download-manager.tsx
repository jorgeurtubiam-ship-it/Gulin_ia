// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { PrimitiveAtom } from "jotai";

export type DownloadItem = {
    id: string;
    filename: string;
    url: string;
    receivedBytes: number;
    totalBytes: number;
    state: "progressing" | "completed" | "cancelled" | "interrupted";
    savePath?: string;
    startTime: number;
};

interface DownloadManagerProps {
    isOpenAtom: PrimitiveAtom<boolean>;
    downloadsAtom: PrimitiveAtom<DownloadItem[]>;
    onOpenFile: (savePath: string) => void;
    onShowInFinder: (savePath: string) => void;
    onClearCompleted: () => void;
}

export const DownloadManager = memo(({
    isOpenAtom,
    downloadsAtom,
    onOpenFile,
    onShowInFinder,
    onClearCompleted,
}: DownloadManagerProps) => {
    const [isOpen, setIsOpen] = useAtom(isOpenAtom);
    const downloads = useAtomValue(downloadsAtom);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: "360px",
                maxHeight: "380px",
                backgroundColor: "#1e1e20",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderTopLeftRadius: "12px",
                boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
                zIndex: 140,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                color: "#e6e6e6",
                fontSize: "12px",
            }}
        >
            <div
                style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#252528",
                }}
            >
                <span style={{ fontWeight: 600 }}>📥 Descargas ({downloads.length})</span>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={onClearCompleted}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#9ca3af",
                            cursor: "pointer",
                            fontSize: "11px",
                        }}
                    >
                        Limpiar
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#9ca3af",
                            cursor: "pointer",
                            fontSize: "13px",
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                {downloads.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#6b7280" }}>
                        No hay descargas activas ni recientes
                    </div>
                ) : (
                    downloads.map((item) => {
                        const progress =
                            item.totalBytes > 0
                                ? Math.round((item.receivedBytes / item.totalBytes) * 100)
                                : item.state === "completed"
                                ? 100
                                : 0;

                        return (
                            <div
                                key={item.id}
                                style={{
                                    padding: "8px 10px",
                                    marginBottom: "6px",
                                    backgroundColor: "rgba(255, 255, 255, 0.04)",
                                    borderRadius: "8px",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                    <span
                                        style={{
                                            fontWeight: 500,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            maxWidth: "220px",
                                        }}
                                        title={item.filename}
                                    >
                                        {item.filename}
                                    </span>
                                    <span style={{ color: item.state === "completed" ? "#34d399" : "#60a5fa" }}>
                                        {item.state === "completed" ? "✓ Listo" : `${progress}%`}
                                    </span>
                                </div>

                                <div
                                    style={{
                                        width: "100%",
                                        height: "4px",
                                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                                        borderRadius: "2px",
                                        overflow: "hidden",
                                        marginBottom: "6px",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: "100%",
                                            width: `${progress}%`,
                                            backgroundColor: item.state === "completed" ? "#34d399" : "#3b82f6",
                                            transition: "width 0.2s ease",
                                        }}
                                    />
                                </div>

                                {item.state === "completed" && item.savePath && (
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={() => onOpenFile(item.savePath!)}
                                            style={{
                                                backgroundColor: "#3b82f6",
                                                color: "white",
                                                border: "none",
                                                borderRadius: "4px",
                                                padding: "2px 8px",
                                                fontSize: "11px",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Abrir
                                        </button>
                                        <button
                                            onClick={() => onShowInFinder(item.savePath!)}
                                            style={{
                                                backgroundColor: "rgba(255, 255, 255, 0.1)",
                                                color: "#d1d5db",
                                                border: "none",
                                                borderRadius: "4px",
                                                padding: "2px 8px",
                                                fontSize: "11px",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Mostrar en Finder
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
});

DownloadManager.displayName = "DownloadManager";
