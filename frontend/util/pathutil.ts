// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getApi, globalStore, WOS } from "@/app/store/global";
import { getActiveTabModel } from "@/app/store/tab-model";

/**
 * Get active working directory from currently focused block or recent block.
 */
export function getActiveCwd(): string {
    try {
        const tabModel = getActiveTabModel();
        if (tabModel) {
            const tabData = globalStore.get(tabModel.tabAtom);
            if (tabData?.blockids) {
                for (let i = tabData.blockids.length - 1; i >= 0; i--) {
                    const blockId = tabData.blockids[i];
                    const blockAtom = WOS.getGulinObjectAtom<Block>(`block:${blockId}`);
                    const blockData = globalStore.get(blockAtom);
                    if (blockData?.meta?.["cmd:cwd"]) {
                        return blockData.meta["cmd:cwd"];
                    }
                    if (blockData?.meta?.view === "preview" && blockData?.meta?.file) {
                        const f = blockData.meta.file;
                        return f.endsWith("/") ? f.slice(0, -1) : f.substring(0, f.lastIndexOf("/")) || f;
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Failed to get active cwd:", e);
    }
    return "";
}

/**
 * Resolves a file path to its full absolute filesystem path,
 * expanding '~', resolving relative paths with active cwd,
 * and normalizing slashes.
 */
export function resolveFullPath(targetPath: string): string {
    if (!targetPath) return "";
    let cleanPath = targetPath.trim();

    // Strip file:// or file:/// prefix if present
    if (/^file:\/\//i.test(cleanPath)) {
        cleanPath = decodeURIComponent(cleanPath.replace(/^file:\/\//i, ""));
    }

    // If it starts with /~ on Unix/mac (e.g. /~/Desktop), strip the leading slash
    if (cleanPath.startsWith("/~")) {
        cleanPath = cleanPath.slice(1);
    }

    // Expand ~
    let homeDir = "";
    try {
        homeDir = getApi().getHomeDir?.() || "";
    } catch (_) {}

    if (cleanPath.startsWith("~/") || cleanPath === "~") {
        if (homeDir) {
            cleanPath = cleanPath === "~" ? homeDir : `${homeDir}/${cleanPath.slice(2)}`;
        }
    } else if (!cleanPath.startsWith("/") && !/^[a-zA-Z]:[\\/]/.test(cleanPath)) {
        // Relative path: resolve against active cwd or homeDir
        const cwd = getActiveCwd();
        if (cwd) {
            const baseCwd = cwd.endsWith("/") ? cwd : cwd + "/";
            cleanPath = baseCwd + cleanPath.replace(/^\.\//, "");
        } else if (homeDir) {
            cleanPath = `${homeDir}/${cleanPath.replace(/^\.\//, "")}`;
        }
    }

    return cleanPath.replace(/\\/g, "/");
}

/**
 * Returns a valid file:// URL for Chromium/Electron webview with full absolute path.
 */
export function formatFileUrl(filePath: string): string {
    const resolved = resolveFullPath(filePath);
    if (!resolved) return "";
    return resolved.startsWith("/") ? `file://${resolved}` : `file:///${resolved}`;
}
