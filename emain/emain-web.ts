// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ipcMain, webContents, WebContents } from "electron";
import { GulinBrowserWindow } from "./emain-window";
import { WEBMCP_MAIN_WORLD_SCRIPT } from "./webmcp-runtime";

export function getWebContentsByBlockId(ww: GulinBrowserWindow, tabId: string, blockId: string): Promise<WebContents> {
    const prtn = new Promise<WebContents>((resolve, reject) => {
        const randId = Math.floor(Math.random() * 1000000000).toString();
        const respCh = `getWebContentsByBlockId-${randId}`;
        ww?.activeTabView?.webContents.send("webcontentsid-from-blockid", blockId, respCh);
        ipcMain.once(respCh, (event, webContentsId) => {
            if (webContentsId == null) {
                resolve(null);
                return;
            }
            const wc = webContents.fromId(parseInt(webContentsId));
            resolve(wc);
        });
        setTimeout(() => {
            reject(new Error("timeout waiting for response"));
        }, 2000);
    });
    return prtn;
}

function escapeSelector(selector: string): string {
    return selector
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
}

export type WebGetOpts = {
    all?: boolean;
    inner?: boolean;
};

export async function webGetSelector(wc: WebContents, selector: string, opts?: WebGetOpts): Promise<string[]> {
    if (!wc || !selector) {
        return null;
    }
    const escapedSelector = escapeSelector(selector);
    const queryMethod = opts?.all ? "querySelectorAll" : "querySelector";
    const prop = opts?.inner ? "innerHTML" : "outerHTML";
    const execExpr = `
    (() => {
        const toArr = x => (x instanceof NodeList) ? Array.from(x) : (x ? [x] : []);
        try {
            const result = document.${queryMethod}("${escapedSelector}");
            const value = toArr(result).map(el => el.${prop});
            return { value };
        } catch (error) {
            return { error: error.message };
        }
    })()`;
    const results = await wc.executeJavaScript(execExpr);
    if (results.error) {
        throw new Error(results.error);
    }
    return results.value;
}

/**
 * Extracts the inner text of the document body from a webview.
 * @param wc The WebContents of the webview.
 * @returns A promise that resolves to the text content of the page.
 */
export async function webGetText(wc: WebContents): Promise<string> {
    if (!wc) {
        return null;
    }
    const execExpr = `(() => {
        try {
            return { value: document.body.innerText };
        } catch (error) {
            return { error: error.message };
        }
    })()`;
    const result = await wc.executeJavaScript(execExpr);
    if (result.error) {
        throw new Error(result.error);
    }
    return result.value;
}

/**
 * Simulates a click on a web element identified by a CSS selector.
 * @param wc The WebContents of the webview.
 * @param selector The CSS selector of the element to click.
 */
export async function webClick(wc: WebContents, selector: string): Promise<void> {
    if (!wc || !selector) {
        return;
    }
    const escapedSelector = selector
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
    const execExpr = `(() => {
        try {
            const el = document.querySelector("${escapedSelector}");
            if (el) {
                (el as HTMLElement).click();
                return { success: true };
            }
            return { error: "element not found: " + "${escapedSelector}" };
        } catch (error) {
            return { error: error.message };
        }
    })()`;
    const result = await wc.executeJavaScript(execExpr);
    if (result.error) {
        throw new Error(result.error);
    }
}

/**
 * Types text into a web element and dispatches input/change events.
 * @param wc The WebContents of the webview.
 * @param selector The CSS selector of the input/textarea element.
 * @param text The text to enter into the element.
 */
export async function webType(wc: WebContents, selector: string, text: string): Promise<void> {
    if (!wc || !selector) {
        return;
    }
    const escapedSelector = selector
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
    const escapedText = text
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
    const execExpr = `(() => {
        try {
            const el = document.querySelector("${escapedSelector}") as HTMLInputElement | HTMLTextAreaElement;
            if (el) {
                el.focus();
                el.value = "${escapedText}";
                el.dispatchEvent(new Event('focus', { bubbles: true }));
                el.dispatchEvent(new InputEvent('beforeinput', { data: "${escapedText}", inputType: 'insertText', bubbles: true }));
                el.dispatchEvent(new InputEvent('input', { data: "${escapedText}", inputType: 'insertText', bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true };
            }
            return { error: "element not found: " + "${escapedSelector}" };
        } catch (error) {
            return { error: error.message };
        }
    })()`;
    const result = await wc.executeJavaScript(execExpr);
    if (result.error) {
        throw new Error(result.error);
    }
}

/**
 * Executes a native WebMCP tool on the page via document.modelContext.
 */
export async function webExecuteWebMCP(wc: WebContents, toolName: string, params: any): Promise<string> {
    if (!wc || !toolName) throw new Error("Missing wc or toolName");
    const script = `(async () => {
        try {
            if (!document.modelContext) {
                ${WEBMCP_MAIN_WORLD_SCRIPT}
            }
            if (!document.modelContext) {
                return JSON.stringify({ error: "document.modelContext is not defined" });
            }
            const res = await document.modelContext.executeTool(${JSON.stringify(toolName)}, ${JSON.stringify(params || {})});
            return JSON.stringify({ success: true, result: res });
        } catch (e) {
            return JSON.stringify({ error: e?.message || String(e) });
        }
    })()`;
    const jsonStr = await wc.executeJavaScript(script);
    return jsonStr;
}

/**
 * Returns JSON array of all registered WebMCP tools on the active page.
 */
export async function webGetWebMCPTools(wc: WebContents): Promise<string> {
    if (!wc) return "[]";
    const script = `(async () => {
        try {
            if (!document.modelContext) {
                ${WEBMCP_MAIN_WORLD_SCRIPT}
            }
            if (!document.modelContext) return "[]";
            const tools = await document.modelContext.getTools();
            return JSON.stringify(tools);
        } catch (e) {
            return "[]";
        }
    })()`;
    const jsonStr = await wc.executeJavaScript(script);
    return jsonStr;
}
