// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ipcRenderer, webFrame } from "electron";

// ============================================================================
// STEALTH & ANTI-BOT DETECTION EVASION
// Emulates a genuine Google Chrome browser session on macOS
// ============================================================================

export const STEALTH_MAIN_WORLD_SCRIPT = `
(() => {
    try {
        Object.defineProperty(navigator, "webdriver", {
            get: () => undefined,
            configurable: true,
        });
        const proto = Object.getPrototypeOf(navigator);
        if (proto && "webdriver" in proto) {
            delete proto.webdriver;
        }
    } catch (_) {}

    try {
        if (!window.chrome) {
            window.chrome = {};
        }
        const chromeObj = window.chrome;
        if (!chromeObj.runtime) {
            chromeObj.runtime = {
                connect: () => {},
                sendMessage: () => {},
                OnInstalledReason: {},
                OnRestartRequiredReason: {},
                PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
                PlatformNaclArch: { ARM: "arm", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
                PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
                RequestUpdateCheckStatus: { NO_UPDATE: "no_update", THROTTLED: "throttled", UPDATE_AVAILABLE: "update_available" },
            };
        }
        if (!chromeObj.loadTimes) {
            chromeObj.loadTimes = function () {
                return {
                    requestTime: performance.now() / 1000,
                    startLoadTime: performance.now() / 1000,
                    commitLoadTime: performance.now() / 1000,
                    finishDocumentLoadTime: performance.now() / 1000,
                    finishLoadTime: performance.now() / 1000,
                    firstPaintTime: performance.now() / 1000,
                    firstPaintAfterLoadTime: 0,
                    navigationType: "Other",
                    wasFetchedViaSpdy: true,
                    wasNpnNegotiated: true,
                    npnNegotiatedProtocol: "h2",
                    wasAlternateProtocolAvailable: false,
                    connectionInfo: "h2",
                };
            };
        }
        if (!chromeObj.csi) {
            chromeObj.csi = function () {
                return {
                    startE: performance.now(),
                    onloadT: performance.now(),
                    pageT: performance.now(),
                    tran: 15,
                };
            };
        }
        if (!chromeObj.app) {
            chromeObj.app = {
                isInstalled: false,
                InstallState: { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" },
                RunningState: { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" },
            };
        }
    } catch (_) {}

    try {
        if (!navigator.plugins || navigator.plugins.length === 0) {
            const mockPlugins = [
                { name: "PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
                { name: "Chrome PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
                { name: "Chromium PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
                { name: "Microsoft Edge PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
                { name: "WebKit built-in PDF", filename: "internal-pdf-viewer", description: "Portable Document Format" },
            ];
            Object.defineProperty(navigator, "plugins", {
                get: () => mockPlugins,
                configurable: true,
            });
        }
    } catch (_) {}

    try {
        Object.defineProperty(navigator, "languages", {
            get: () => ["es-CL", "es", "es-419", "en-US", "en"],
            configurable: true,
        });
    } catch (_) {}

    try {
        if (navigator.permissions && navigator.permissions.query) {
            const origQuery = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = (parameters) => {
                if (parameters && parameters.name === "notifications") {
                    return Promise.resolve({
                        state: Notification.permission || "default",
                        name: "notifications",
                        onchange: null,
                    });
                }
                return origQuery(parameters);
            };
        }
    } catch (_) {}
})();
`;

function injectStealthIntoMainWorld() {
    try {
        if (webFrame && typeof webFrame.executeJavaScript === "function") {
            webFrame.executeJavaScript(STEALTH_MAIN_WORLD_SCRIPT);
        }
    } catch (_) {}

    try {
        const script = document.createElement("script");
        script.textContent = STEALTH_MAIN_WORLD_SCRIPT;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    } catch (_) {}
}

// 1. Inject into Main World
injectStealthIntoMainWorld();
if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", injectStealthIntoMainWorld);
    window.addEventListener("load", injectStealthIntoMainWorld);
}

// 2. Also patch isolated preload world
try {
    Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
        configurable: true,
    });
    const proto = Object.getPrototypeOf(navigator);
    if (proto && "webdriver" in proto) {
        delete (proto as any).webdriver;
    }
} catch (_) {}

// ============================================================================
// CONTEXT MENU & COMMUNICATION LISTENERS
// ============================================================================

document.addEventListener("contextmenu", (event) => {
    console.log("contextmenu event", event);
    if (event.target == null) {
        return;
    }
    const targetElement = event.target as HTMLElement;
    // Check if the right-click is on an image
    if (targetElement.tagName === "IMG") {
        setTimeout(() => {
            if (event.defaultPrevented) {
                return;
            }
            event.preventDefault();
            const imgElem = targetElement as HTMLImageElement;
            const imageUrl = imgElem.src;
            ipcRenderer.send("webview-image-contextmenu", { src: imageUrl });
        }, 50);
        return;
    }
    // do nothing
});

ipcRenderer.on("webview-get-text", (event) => {
    const text = document.body.innerText;
    ipcRenderer.send("webview-get-text-response", { text });
});

// ============================================================================
// W3C WebMCP (Web Model Context Protocol) Initialization
// ============================================================================
import { setupWebMCP, RegisteredTool, WEBMCP_MAIN_WORLD_SCRIPT } from "./webmcp-runtime";
import { registerSiteAdapters } from "./webmcp-site-adapters";

// 1. Setup in Preload/Isolated World
const modelContext = setupWebMCP(document, (tools: RegisteredTool[]) => {
    ipcRenderer.send("webmcp-tools-updated", {
        origin: window.location.origin,
        url: window.location.href,
        tools,
    });
});

if (typeof window !== "undefined") {
    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", () => {
            registerSiteAdapters(modelContext, window.location.href);
        });
    } else {
        registerSiteAdapters(modelContext, window.location.href);
    }
}

// 2. Inject WebMCP directly into Main World so document.modelContext exists for page scripts, DevTools, and executeJavaScript
function injectWebMCPIntoMainWorld() {
    try {
        if (webFrame && typeof webFrame.executeJavaScript === "function") {
            webFrame.executeJavaScript(WEBMCP_MAIN_WORLD_SCRIPT);
        }
    } catch (_) {}

    try {
        const script = document.createElement("script");
        script.textContent = WEBMCP_MAIN_WORLD_SCRIPT;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    } catch (_) {}
}

injectWebMCPIntoMainWorld();
if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", injectWebMCPIntoMainWorld);
    window.addEventListener("load", injectWebMCPIntoMainWorld);
}

// IPC Listener to query tools from host
ipcRenderer.on("webmcp-get-tools", async (_event, { requestId }) => {
    try {
        const tools = await modelContext.getTools();
        ipcRenderer.send("webmcp-get-tools-response", { requestId, tools });
    } catch (e: any) {
        ipcRenderer.send("webmcp-get-tools-response", { requestId, tools: [], error: e?.message });
    }
});

// IPC Listener to execute tools from host
ipcRenderer.on("webmcp-execute-tool", async (_event, { requestId, toolName, params }) => {
    try {
        const result = await modelContext.executeTool(toolName, params);
        ipcRenderer.send("webmcp-execute-tool-response", { requestId, success: true, result });
    } catch (err: any) {
        ipcRenderer.send("webmcp-execute-tool-response", { requestId, success: false, error: err?.message || String(err) });
    }
});

console.log("loaded gulin preload-webview.ts with stealth mode and WebMCP active");
