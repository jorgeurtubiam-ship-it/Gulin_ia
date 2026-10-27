// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { PrimitiveAtom } from "jotai";

export interface WebMCPToolInfo {
    name: string;
    description: string;
    inputSchema?: any;
    origin?: string;
}

interface WebMCPBadgeProps {
    toolsAtom: PrimitiveAtom<WebMCPToolInfo[]>;
    isOpenAtom: PrimitiveAtom<boolean>;
    onExecuteTool?: (toolName: string, params: any) => Promise<any>;
}

export const WebMCPBadge = memo(({ toolsAtom, isOpenAtom, onExecuteTool }: WebMCPBadgeProps) => {
    const tools = useAtomValue(toolsAtom);
    const [isOpen, setIsOpen] = useAtom(isOpenAtom);
    const [executingTool, setExecutingTool] = useState<string | null>(null);
    const [execResult, setExecResult] = useState<{ tool: string; result: any } | null>(null);

    if (!tools || tools.length === 0) {
        return null;
    }

    const handleRunTool = async (tool: WebMCPToolInfo) => {
        if (!onExecuteTool) return;
        setExecutingTool(tool.name);
        setExecResult(null);
        try {
            const defaultParams: Record<string, any> = {};
            if (tool.inputSchema?.properties) {
                for (const key of Object.keys(tool.inputSchema.properties)) {
                    if (key === "limit") defaultParams[key] = 10;
                    if (key === "query") defaultParams[key] = "arenero";
                }
            }
            const res = await onExecuteTool(tool.name, defaultParams);
            setExecResult({ tool: tool.name, result: res });
        } catch (err: any) {
            setExecResult({ tool: tool.name, result: { error: err?.message || String(err) } });
        } finally {
            setExecutingTool(null);
        }
    };

    return (
        <div style={{ position: "absolute", top: "10px", right: "12px", zIndex: 120 }}>
            {/* Pill Indicator */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(18, 24, 38, 0.88)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(59, 130, 246, 0.45)",
                    borderRadius: "14px",
                    padding: "4px 10px",
                    color: "#60a5fa",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
                    transition: "all 0.15s ease",
                }}
                title="Herramientas WebMCP disponibles en esta página (W3C Standard)"
            >
                <span style={{ fontSize: "12px" }}>⚡</span>
                <span>WebMCP</span>
                <span
                    style={{
                        background: "rgba(59, 130, 246, 0.25)",
                        color: "#93c5fd",
                        borderRadius: "8px",
                        padding: "1px 5px",
                        fontSize: "10px",
                    }}
                >
                    {tools.length}
                </span>
            </button>

            {/* Popover Inspector */}
            {isOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: "32px",
                        right: "0",
                        width: "360px",
                        maxHeight: "480px",
                        overflowY: "auto",
                        background: "#16181d",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "10px",
                        padding: "14px",
                        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.6)",
                        color: "#e2e8f0",
                        fontFamily: "system-ui, -apple-system, sans-serif",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "10px",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                            paddingBottom: "8px",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "14px" }}>⚡</span>
                            <span style={{ fontWeight: 600, fontSize: "13px", color: "#f8fafc" }}>
                                WebMCP Tools ({tools.length})
                            </span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: "none",
                                border: "none",
                                color: "#94a3b8",
                                cursor: "pointer",
                                fontSize: "14px",
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    <p style={{ fontSize: "11px", color: "#94a3b8", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                        Esta página expone funciones nativas cliente bajo el estándar W3C WebMCP. Gulin AI puede invocarlas directamente.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {tools.map((t) => (
                            <div
                                key={t.name}
                                style={{
                                    background: "rgba(255, 255, 255, 0.03)",
                                    border: "1px solid rgba(255, 255, 255, 0.06)",
                                    borderRadius: "6px",
                                    padding: "8px 10px",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                    <span
                                        style={{
                                            fontFamily: "monospace",
                                            fontWeight: 600,
                                            fontSize: "12px",
                                            color: "#38bdf8",
                                        }}
                                    >
                                        {t.name}
                                    </span>
                                    {t.origin && (
                                        <span
                                            style={{
                                                fontSize: "9px",
                                                background: "rgba(99, 102, 241, 0.15)",
                                                color: "#a5b4fc",
                                                padding: "1px 4px",
                                                borderRadius: "4px",
                                            }}
                                        >
                                            {t.origin}
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: "11px", color: "#cbd5e1", margin: "0 0 6px 0", lineHeight: "1.3" }}>
                                    {t.description}
                                </p>
                                {onExecuteTool && (
                                    <button
                                        onClick={() => handleRunTool(t)}
                                        disabled={executingTool === t.name}
                                        style={{
                                            background: "rgba(59, 130, 246, 0.15)",
                                            border: "1px solid rgba(59, 130, 246, 0.3)",
                                            color: "#93c5fd",
                                            borderRadius: "4px",
                                            padding: "2px 8px",
                                            fontSize: "10px",
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                        }}
                                    >
                                        {executingTool === t.name ? "⏳ Ejecutando..." : "▶ Probar herramienta"}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {execResult && (
                        <div
                            style={{
                                marginTop: "10px",
                                padding: "8px",
                                background: "#0f172a",
                                border: "1px solid rgba(59, 130, 246, 0.3)",
                                borderRadius: "6px",
                            }}
                        >
                            <div style={{ fontSize: "10px", color: "#60a5fa", fontWeight: 600, marginBottom: "4px" }}>
                                Resultado de {execResult.tool}:
                            </div>
                            <pre
                                style={{
                                    fontSize: "10px",
                                    color: "#e2e8f0",
                                    maxHeight: "120px",
                                    overflowY: "auto",
                                    margin: 0,
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-all",
                                }}
                            >
                                {typeof execResult.result === "string"
                                    ? execResult.result
                                    : JSON.stringify(execResult.result, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

WebMCPBadge.displayName = "WebMCPBadge";
