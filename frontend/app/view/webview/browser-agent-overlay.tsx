// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import { useAtomValue } from "jotai";
import { PrimitiveAtom } from "jotai";

interface BrowserAgentOverlayProps {
    isActiveAtom: PrimitiveAtom<boolean>;
    currentActionAtom: PrimitiveAtom<string>;
    onStop: () => void;
}

export const BrowserAgentOverlay = memo(({ isActiveAtom, currentActionAtom, onStop }: BrowserAgentOverlayProps) => {
    const isActive = useAtomValue(isActiveAtom);
    const currentAction = useAtomValue(currentActionAtom);

    if (!isActive) return null;

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.35)",
                zIndex: 150,
                pointerEvents: "auto",
                backdropFilter: "blur(1px)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "center",
                paddingBottom: "24px",
            }}
        >
            <div
                style={{
                    backgroundColor: "rgba(22, 22, 24, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    borderRadius: "24px",
                    padding: "10px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                    fontSize: "13px",
                    fontWeight: 500,
                }}
            >
                <div
                    style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        border: "2px solid #58a6ff",
                        borderTopColor: "transparent",
                        animation: "spin 1s linear infinite",
                    }}
                />
                <style>
                    {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
                </style>
                <span>🤖 IA en control: {currentAction || "Procesando página..."}</span>
                <button
                    onClick={onStop}
                    style={{
                        backgroundColor: "#dc2626",
                        color: "white",
                        border: "none",
                        borderRadius: "12px",
                        padding: "4px 12px",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "12px",
                    }}
                >
                    ⛔ Detener
                </button>
            </div>
        </div>
    );
});

BrowserAgentOverlay.displayName = "BrowserAgentOverlay";
