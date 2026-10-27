// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { PrimitiveAtom } from "jotai";

export type WebTab = {
    id: string;
    url: string;
    title: string;
    isPinned?: boolean;
    isLoading?: boolean;
};

interface WebviewTabbarProps {
    tabsAtom: PrimitiveAtom<WebTab[]>;
    activeTabIdAtom: PrimitiveAtom<string>;
    onSelectTab: (id: string) => void;
    onCloseTab: (id: string) => void;
    onNewTab: () => void;
    onPinTab?: (id: string) => void;
}

export const WebviewTabbar = memo(({
    tabsAtom,
    activeTabIdAtom,
    onSelectTab,
    onCloseTab,
    onNewTab,
}: WebviewTabbarProps) => {
    const tabs = useAtomValue(tabsAtom);
    const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom);

    // Si solo hay una pestaña y no tiene título o URL, o si queremos mostrar pestañas sólo cuando hay 1 o más:
    if (tabs.length <= 1 && !tabs[0]?.url) return null;

    return (
        <div
            style={{
                height: "28px",
                backgroundColor: "#18181b",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                padding: "0 6px",
                gap: "3px",
                overflowX: "auto",
                userSelect: "none",
            }}
        >
            {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                    <div
                        key={tab.id}
                        onClick={() => {
                            setActiveTabId(tab.id);
                            onSelectTab(tab.id);
                        }}
                        style={{
                            height: "22px",
                            maxWidth: "180px",
                            minWidth: "70px",
                            backgroundColor: isActive ? "#27272a" : "transparent",
                            border: isActive ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid transparent",
                            borderBottom: isActive ? "2px solid #3b82f6" : "none",
                            borderRadius: "4px 4px 0 0",
                            padding: "0 8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            cursor: "pointer",
                            fontSize: "11px",
                            color: isActive ? "#ffffff" : "#9ca3af",
                            transition: "background 0.1s",
                        }}
                    >
                        {tab.isLoading ? (
                            <span style={{ fontSize: "10px" }}>⏳</span>
                        ) : tab.isPinned ? (
                            <span style={{ fontSize: "10px" }}>📌</span>
                        ) : (
                            <span style={{ fontSize: "10px" }}>🌐</span>
                        )}
                        <span
                            style={{
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {tab.title || tab.url || "Nueva pestaña"}
                        </span>
                        {tabs.length > 1 && (
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseTab(tab.id);
                                }}
                                style={{
                                    fontSize: "12px",
                                    color: "#6b7280",
                                    padding: "0 2px",
                                    cursor: "pointer",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
                            >
                                ✕
                            </span>
                        )}
                    </div>
                );
            })}

            <button
                onClick={onNewTab}
                style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: "14px",
                    lineHeight: 1,
                    marginLeft: "2px",
                }}
                title="Nueva pestaña (Cmd+T)"
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
                +
            </button>
        </div>
    );
});

WebviewTabbar.displayName = "WebviewTabbar";
