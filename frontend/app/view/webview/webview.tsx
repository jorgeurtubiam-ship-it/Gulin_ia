// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { Search, useSearch } from "@/app/element/search";
import { createBlock, getApi, getBlockMetaKeyAtom, getSettingsKeyAtom, openLink } from "@/app/store/global";
import { GulinAIModel } from "@/app/aipanel/gulinai-model";
import { getSimpleControlShiftAtom } from "@/app/store/keymodel";
import { ObjectService } from "@/app/store/services";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import {
    BlockHeaderSuggestionControl,
    SuggestionControlNoData,
    SuggestionControlNoResults,
} from "@/app/suggestion/suggestion";
import { WOS, globalStore } from "@/store/global";
import { adaptFromReactOrNativeKeyEvent, checkKeyPressed } from "@/util/keyutil";
import { fireAndForget, useAtomValueSafe } from "@/util/util";
import { formatFileUrl } from "@/util/pathutil";
import clsx from "clsx";
import { WebviewTag } from "electron";
import { Atom, PrimitiveAtom, atom, useAtomValue, useSetAtom } from "jotai";
import { Fragment, createRef, memo, useCallback, useEffect, useRef, useState } from "react";
import "./webview.scss";

import { BrowserAgentOverlay } from "./browser-agent-overlay";
import { WebviewCommandPalette } from "./webview-command-palette";
import { WebviewTabbar, type WebTab } from "./webview-tabbar";
import { DownloadManager, type DownloadItem } from "./download-manager";
import { WebHistoryPanel, type HistoryEntry } from "./web-history-panel";
import { WebviewBookmarks, type BookmarkItem } from "./webview-bookmarks";
import { ReadingList, type ReadingListItem } from "./reading-list";
import { WebviewQuickSwitcher, type SwitcherItem } from "./webview-quick-switcher";
import { toggleReaderModeScript } from "./reader-mode";
import { getClipPageScript, formatAsMarkdown } from "./web-clipper";
import { executeBrowserAgentTool } from "./browser-agent-tools";
import { WebMCPBadge, type WebMCPToolInfo } from "./webmcp-badge";

// User agent strings (Genuine Google Chrome on macOS avoids anti-bot CAPTCHA)
const USER_AGENT_DESKTOP =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const USER_AGENT_IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const USER_AGENT_ANDROID =
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36";

let webviewPreloadUrl = null;

function getWebviewPreloadUrl() {
    if (webviewPreloadUrl == null) {
        webviewPreloadUrl = getApi().getWebviewPreload();
        console.log("webviewPreloadUrl", webviewPreloadUrl);
    }
    if (webviewPreloadUrl == null) {
        return null;
    }
    return "file://" + webviewPreloadUrl;
}

export class WebViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    tabModel: TabModel;
    noPadding?: Atom<boolean>;
    blockAtom: Atom<Block>;
    viewIcon: Atom<string | IconButtonDecl>;
    viewName: Atom<string>;
    viewText: Atom<HeaderElem[]>;
    hideViewName: Atom<boolean>;
    url: PrimitiveAtom<string>;
    homepageUrl: Atom<string>;
    urlInputFocused: PrimitiveAtom<boolean>;
    isLoading: PrimitiveAtom<boolean>;
    loadProgress: PrimitiveAtom<number>;
    urlWrapperClassName: PrimitiveAtom<string>;
    refreshIcon: PrimitiveAtom<string>;
    webviewRef: React.RefObject<WebviewTag>;
    urlInputRef: React.RefObject<HTMLInputElement>;
    nodeModel: BlockNodeModel;
    endIconButtons?: Atom<IconButtonDecl[]>;
    mediaPlaying: PrimitiveAtom<boolean>;
    mediaMuted: PrimitiveAtom<boolean>;
    modifyExternalUrl?: (url: string) => string;
    domReady: PrimitiveAtom<boolean>;
    hideNav: Atom<boolean>;
    searchAtoms?: SearchAtoms;
    typeaheadOpen: PrimitiveAtom<boolean>;
    partitionOverride: PrimitiveAtom<string> | null;
    userAgentType: Atom<string>;
    readAloudActive: PrimitiveAtom<boolean>;

    // New Browser Feature Atoms
    isBrowserAgentActive: PrimitiveAtom<boolean>;
    browserAgentAction: PrimitiveAtom<string>;
    isCommandPaletteOpen: PrimitiveAtom<boolean>;
    isHistoryOpen: PrimitiveAtom<boolean>;
    isBookmarksOpen: PrimitiveAtom<boolean>;
    isReadingListOpen: PrimitiveAtom<boolean>;
    isDownloadsOpen: PrimitiveAtom<boolean>;
    isQuickSwitcherOpen: PrimitiveAtom<boolean>;
    historyList: PrimitiveAtom<HistoryEntry[]>;
    bookmarksList: PrimitiveAtom<BookmarkItem[]>;
    readingList: PrimitiveAtom<ReadingListItem[]>;
    downloadsList: PrimitiveAtom<DownloadItem[]>;
    tabsList: PrimitiveAtom<WebTab[]>;
    activeTabId: PrimitiveAtom<string>;
    isAdblockEnabled: PrimitiveAtom<boolean>;
    isDarkModeForced: PrimitiveAtom<boolean>;
    webmcpTools: PrimitiveAtom<WebMCPToolInfo[]>;
    isWebMcpPopoverOpen: PrimitiveAtom<boolean>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.viewType = "web";
        this.blockId = blockId;
        this.noPadding = atom(true);
        this.blockAtom = WOS.getGulinObjectAtom<Block>(`block:${blockId}`);
        this.url = atom();
        const defaultUrlAtom = getSettingsKeyAtom("web:defaulturl");
        this.homepageUrl = atom((get) => {
            const defaultUrl = get(defaultUrlAtom);
            const pinnedUrl = get(this.blockAtom).meta.pinnedurl;
            return pinnedUrl ?? defaultUrl;
        });
        this.urlWrapperClassName = atom("");
        this.urlInputFocused = atom(false);
        this.isLoading = atom(false);
        this.loadProgress = atom(0);
        this.refreshIcon = atom("rotate-right");
        this.viewIcon = atom("globe");
        this.viewName = atom("Web");
        this.hideViewName = atom(true);
        this.urlInputRef = createRef<HTMLInputElement>();
        this.webviewRef = createRef<WebviewTag>();
        this.domReady = atom(false);
        this.hideNav = getBlockMetaKeyAtom(blockId, "web:hidenav");
        this.typeaheadOpen = atom(false);
        this.partitionOverride = null;
        this.userAgentType = getBlockMetaKeyAtom(blockId, "web:useragenttype");

        this.mediaPlaying = atom(false);
        this.mediaMuted = atom(false);
        this.readAloudActive = atom(false);

        // Feature atoms initialization
        this.isBrowserAgentActive = atom(false);
        this.browserAgentAction = atom("");
        this.isCommandPaletteOpen = atom(false);
        this.isHistoryOpen = atom(false);
        this.isBookmarksOpen = atom(false);
        this.isReadingListOpen = atom(false);
        this.isDownloadsOpen = atom(false);
        this.isQuickSwitcherOpen = atom(false);
        this.historyList = atom<HistoryEntry[]>([]);
        this.bookmarksList = atom<BookmarkItem[]>([]);
        this.readingList = atom<ReadingListItem[]>([]);
        this.downloadsList = atom<DownloadItem[]>([]);
        this.tabsList = atom<WebTab[]>([{ id: "tab-1", url: "", title: "Pestaña 1" }]);
        this.activeTabId = atom<string>("tab-1");
        this.isAdblockEnabled = atom(false);
        this.isDarkModeForced = atom(false);
        this.webmcpTools = atom<WebMCPToolInfo[]>([]);
        this.isWebMcpPopoverOpen = atom(false);

        // Registrar este WebViewModel globalmente para que Gulin AI pueda accederlo
        (window as any).activeGulinWebViewModel = this;
        (window as any).executeBrowserAgentTool = (toolName: string, params: any) =>
            this.runAgentTool(toolName, params);

        this.viewText = atom((get) => {
            const homepageUrl = get(this.homepageUrl);
            const metaUrl = get(this.blockAtom)?.meta?.url;
            const currUrl = get(this.url);
            const urlWrapperClassName = get(this.urlWrapperClassName);
            const refreshIcon = get(this.refreshIcon);
            const mediaPlaying = get(this.mediaPlaying);
            const mediaMuted = get(this.mediaMuted);
            const url = currUrl ?? metaUrl ?? homepageUrl;
            const rtn: HeaderElem[] = [];
            if (get(this.hideNav)) {
                return rtn;
            }

            rtn.push({
                elemtype: "iconbutton",
                icon: "chevron-left",
                click: this.handleBack.bind(this),
                disabled: this.shouldDisableBackButton(),
            });
            rtn.push({
                elemtype: "iconbutton",
                icon: "chevron-right",
                click: this.handleForward.bind(this),
                disabled: this.shouldDisableForwardButton(),
            });
            rtn.push({
                elemtype: "iconbutton",
                icon: "house",
                click: this.handleHome.bind(this),
                disabled: this.shouldDisableHomeButton(),
            });
            rtn.push({
                elemtype: "iconbutton",
                icon: "folder-open",
                title: "Abrir archivo HTML local",
                click: () => fireAndForget(this.handleOpenLocalFile.bind(this)),
            });
            const divChildren: HeaderElem[] = [];
            divChildren.push({
                elemtype: "input",
                value: url,
                ref: this.urlInputRef,
                className: "url-input",
                onChange: this.handleUrlChange.bind(this),
                onKeyDown: this.handleKeyDown.bind(this),
                onFocus: this.handleFocus.bind(this),
                onBlur: this.handleBlur.bind(this),
            });
            if (mediaPlaying) {
                divChildren.push({
                    elemtype: "iconbutton",
                    icon: mediaMuted ? "volume-slash" : "volume",
                    click: this.handleMuteChange.bind(this),
                });
            }
            divChildren.push({
                elemtype: "iconbutton",
                icon: refreshIcon,
                click: this.handleRefresh.bind(this),
            });
            rtn.push({
                elemtype: "div",
                className: clsx("block-frame-div-url", urlWrapperClassName),
                onMouseOver: this.handleUrlWrapperMouseOver.bind(this),
                onMouseOut: this.handleUrlWrapperMouseOut.bind(this),
                children: divChildren,
            });
            return rtn;
        });

        this.endIconButtons = atom((get) => {
            if (get(this.hideNav)) {
                return null;
            }
            const url = get(this.url);
            const userAgentType = get(this.userAgentType);
            const buttons: IconButtonDecl[] = [];

            // Add mobile indicator icon if using mobile user agent
            if (userAgentType === "mobile:iphone" || userAgentType === "mobile:android") {
                const mobileIcon = userAgentType === "mobile:iphone" ? "mobile-screen" : "mobile-screen-button";
                const mobileTitle =
                    userAgentType === "mobile:iphone" ? "Mobile User Agent: iPhone" : "Mobile User Agent: Android";
                buttons.push({
                    elemtype: "iconbutton",
                    icon: mobileIcon,
                    title: mobileTitle,
                    noAction: true,
                });
            }

            buttons.push({
                elemtype: "iconbutton",
                icon: "arrow-up-right-from-square",
                title: "Open in External Browser",
                click: () => {
                    console.log("open external", url);
                    if (url != null && url != "") {
                        const externalUrl = this.modifyExternalUrl?.(url) ?? url;
                        return getApi().openExternal(externalUrl);
                    }
                },
            });

            // Browser Agent — Botón "Enviar al Chat de IA"
            buttons.push({
                elemtype: "iconbutton",
                icon: "comment",
                title: "Enviar al Chat de IA",
                click: () => {
                    const currentUrl = this.getUrl();
                    if (currentUrl != null && currentUrl !== "") {
                        try {
                            const aiModel = GulinAIModel.getInstance();
                            const currentInput = globalStore.get(aiModel.inputAtom);
                            const urlContext = currentInput
                                ? `${currentInput}\n\n[Contexto web: ${currentUrl}]`
                                : `[Contexto web: ${currentUrl}]\n`;
                            globalStore.set(aiModel.inputAtom, urlContext);
                        } catch (e) {
                            console.warn("No se pudo enviar al chat de IA:", e);
                        }
                    }
                },
            });

            // Botón "Anclar página" (Pin)
            buttons.push({
                elemtype: "iconbutton",
                icon: "thumbtack",
                title: "Anclar esta página como homepage del bloque",
                click: () => {
                    fireAndForget(() => this.setHomepageUrl(this.getUrl(), "block"));
                },
            });

            // ⭐ Botón "Marcadores / Favoritos"
            buttons.push({
                elemtype: "iconbutton",
                icon: "star",
                title: "Marcadores / Favoritos",
                click: () => {
                    const isOpen = globalStore.get(this.isBookmarksOpen);
                    globalStore.set(this.isBookmarksOpen, !isOpen);
                },
            });

            // 📖 Botón "Modo Lector"
            buttons.push({
                elemtype: "iconbutton",
                icon: "book-open",
                title: "Modo Lector (Reader Mode)",
                click: () => this.toggleReaderMode(),
            });

            // 📥 Botón "Descargas"
            buttons.push({
                elemtype: "iconbutton",
                icon: "download",
                title: "Gestor de Descargas",
                click: () => {
                    const isOpen = globalStore.get(this.isDownloadsOpen);
                    globalStore.set(this.isDownloadsOpen, !isOpen);
                },
            });

            // ⚡ Botón "Paleta de Comandos" (Cmd+K)
            buttons.push({
                elemtype: "iconbutton",
                icon: "wand-magic-sparkles",
                title: "Paleta de Comandos (Cmd+K)",
                click: () => {
                    const isOpen = globalStore.get(this.isCommandPaletteOpen);
                    globalStore.set(this.isCommandPaletteOpen, !isOpen);
                },
            });

            return buttons;
        });
    }

    get viewComponent(): ViewComponent {
        return WebView;
    }

    /**
     * Whether the back button in the header should be disabled.
     * @returns True if the WebView cannot go back or if the WebView call fails. False otherwise.
     */
    shouldDisableBackButton() {
        try {
            return !this.webviewRef.current?.canGoBack();
        } catch (_) {}
        return true;
    }

    /**
     * Whether the forward button in the header should be disabled.
     * @returns True if the WebView cannot go forward or if the WebView call fails. False otherwise.
     */
    shouldDisableForwardButton() {
        try {
            return !this.webviewRef.current?.canGoForward();
        } catch (_) {}
        return true;
    }

    /**
     * Whether the home button in the header should be disabled.
     * @returns True if the current url is the pinned url or the pinned url is not set. False otherwise.
     */
    shouldDisableHomeButton() {
        try {
            const homepageUrl = globalStore.get(this.homepageUrl);
            return !homepageUrl || this.getUrl() === homepageUrl;
        } catch (_) {}
        return true;
    }

    handleHome(e?: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.loadUrl(globalStore.get(this.homepageUrl), "home");
    }

    setMediaPlaying(isPlaying: boolean) {
        globalStore.set(this.mediaPlaying, isPlaying);
    }

    handleMuteChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            const newMutedVal = !this.webviewRef.current?.isAudioMuted();
            globalStore.set(this.mediaMuted, newMutedVal);
            this.webviewRef.current?.setAudioMuted(newMutedVal);
        } catch (e) {
            console.error("Failed to change mute value", e);
        }
    }

    setTypeaheadOpen(open: boolean) {
        globalStore.set(this.typeaheadOpen, open);
    }

    async fetchBookmarkSuggestions(
        query: string,
        reqContext: SuggestionRequestContext
    ): Promise<FetchSuggestionsResponse> {
        const result = await RpcApi.FetchSuggestionsCommand(TabRpcClient, {
            suggestiontype: "bookmark",
            query,
            widgetid: reqContext.widgetid,
            reqnum: reqContext.reqnum,
        });
        return result;
    }

    handleUrlWrapperMouseOver(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        const urlInputFocused = globalStore.get(this.urlInputFocused);
        if (e.type === "mouseover" && !urlInputFocused) {
            globalStore.set(this.urlWrapperClassName, "hovered");
        }
    }

    handleUrlWrapperMouseOut(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        const urlInputFocused = globalStore.get(this.urlInputFocused);
        if (e.type === "mouseout" && !urlInputFocused) {
            globalStore.set(this.urlWrapperClassName, "");
        }
    }

    handleBack(e?: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.webviewRef.current?.goBack();
    }

    handleForward(e?: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.webviewRef.current?.goForward();
    }

    handleRefresh(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.preventDefault();
        e.stopPropagation();
        try {
            if (this.webviewRef.current) {
                if (globalStore.get(this.isLoading)) {
                    this.webviewRef.current.stop();
                } else {
                    this.webviewRef.current.reload();
                }
            }
        } catch (e) {
            console.warn("handleRefresh catch", e);
        }
    }

    handleUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
        globalStore.set(this.url, event.target.value);
    }

    handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        const gulinEvent = adaptFromReactOrNativeKeyEvent(event);
        if (checkKeyPressed(gulinEvent, "Enter")) {
            const url = globalStore.get(this.url);
            this.loadUrl(url, "enter");
            this.urlInputRef.current?.blur();
            return;
        }
        if (checkKeyPressed(gulinEvent, "Escape")) {
            this.webviewRef.current?.focus();
        }
    }

    handleFocus(event: React.FocusEvent<HTMLInputElement>) {
        globalStore.set(this.urlWrapperClassName, "focused");
        globalStore.set(this.urlInputFocused, true);
        this.urlInputRef.current.focus();
        event.target.select();
    }

    handleBlur(event: React.FocusEvent<HTMLInputElement>) {
        globalStore.set(this.urlWrapperClassName, "");
        globalStore.set(this.urlInputFocused, false);
    }

    /**
     * Update the URL in the state when a navigation event has occurred.
     * @param url The URL that has been navigated to.
     */
    handleNavigate(url: string) {
        fireAndForget(() => ObjectService.UpdateObjectMeta(WOS.makeORef("block", this.blockId), { url }));
        globalStore.set(this.url, url);
        if (this.searchAtoms) {
            globalStore.set(this.searchAtoms.isOpen, false);
        }

        // Registrar en el historial de navegación (#3)
        if (url && !url.startsWith("data:") && !url.startsWith("about:")) {
            const currentHistory = globalStore.get(this.historyList);
            const title = this.webviewRef.current?.getTitle?.() || url;
            const existingIdx = currentHistory.findIndex((h) => h.url === url);
            let newHistory: HistoryEntry[];
            if (existingIdx >= 0) {
                newHistory = [...currentHistory];
                newHistory[existingIdx] = {
                    ...newHistory[existingIdx],
                    visitedAt: Date.now(),
                    visitCount: (newHistory[existingIdx].visitCount || 1) + 1,
                    title: title || newHistory[existingIdx].title,
                };
            } else {
                newHistory = [{ url, title, visitedAt: Date.now(), visitCount: 1 }, ...currentHistory].slice(0, 200);
            }
            globalStore.set(this.historyList, newHistory);
        }

        // Actualizar la pestaña activa (#1)
        const tabs = globalStore.get(this.tabsList);
        const activeId = globalStore.get(this.activeTabId);
        const updatedTabs = tabs.map((t) =>
            t.id === activeId ? { ...t, url, title: this.webviewRef.current?.getTitle?.() || url } : t
        );
        globalStore.set(this.tabsList, updatedTabs);
    }

    async handleOpenLocalFile() {
        try {
            const filePath = await getApi().openFileDialog({
                title: "Abrir archivo HTML o Web",
                filters: [
                    { name: "Archivos HTML & Web", extensions: ["html", "htm", "xhtml", "svg", "xml", "mhtml"] },
                    { name: "Todos los archivos", extensions: ["*"] },
                ],
            });
            if (filePath) {
                const fileUrl = formatFileUrl(filePath);
                this.loadUrl(fileUrl, "file-dialog");
            }
        } catch (e) {
            console.error("Error opening local file:", e);
        }
    }

    ensureUrlScheme(url: string, searchTemplate: string) {
        if (url == null) {
            url = "";
        }
        url = url.trim();
        if (url === "") {
            return url;
        }

        // 1. File protocol: file:///path or file://path or file:///~/path
        if (/^file:\/\//i.test(url)) {
            return formatFileUrl(url);
        }

        // 2. HTTP / HTTPS protocol
        if (/^(https?):\/\//i.test(url)) {
            return url;
        }

        // 3. Data / about / blob URLs
        if (/^(data|about|blob):/i.test(url)) {
            return url;
        }

        // 4. Handle home directory path (~/... or ~)
        if (url.startsWith("~/") || url === "~") {
            return formatFileUrl(url);
        }

        // 5. Absolute Unix path (/Users/..., /home/..., /tmp/..., etc.)
        if (url.startsWith("/")) {
            return formatFileUrl(url);
        }

        // 6. Windows absolute path (C:\..., D:/...)
        if (/^[a-zA-Z]:[\\/]/.test(url)) {
            return formatFileUrl(url);
        }

        // 7. Relative file path (./..., ../..., .\..., ..\...)
        if (url.startsWith("./") || url.startsWith("../") || url.startsWith(".\\") || url.startsWith("..\\")) {
            return formatFileUrl(url);
        }

        // 8. Direct HTML/Web file extensions (e.g. index.html, test.htm, app.svg, report.xhtml)
        const webExtRegex = /\.(html|htm|xhtml|svg|xml|mhtml|pdf)$/i;
        if (webExtRegex.test(url) && !url.includes("://")) {
            if (!url.includes("/") && !url.includes("\\")) {
                return formatFileUrl(url);
            }
        }

        // 9. Localhost / IP address check
        const isLocal = /^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/.*)?$/i.test(url);
        if (isLocal) {
            return `http://${url}`;
        }

        // 10. Check if the URL looks like a domain (excluding common file extensions like .html, .htm)
        const domainRegex = /^[a-z0-9.-]+\.(com|org|net|edu|gov|io|ai|dev|app|co|uk|de|fr|es|me|info|biz|tv|cc|xyz|ca|au|jp|cn|us|lat|online|site|tech|cloud|store|shop|blog|design|wiki|[a-z]{2,8})(\/.*)?$/i;
        const isDomain = domainRegex.test(url.split("?")[0].split("#")[0]);

        if (isDomain && !webExtRegex.test(url)) {
            return `https://${url}`;
        }

        // If it starts with www., ensure https://
        if (/^www\.[a-z0-9.-]+/i.test(url)) {
            return `https://${url}`;
        }

        // Otherwise, treat it as a search query
        if (searchTemplate == null) {
            return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
        return searchTemplate.replace("{query}", encodeURIComponent(url));
    }

    /**
     * Load a new URL in the webview.
     * @param newUrl The new URL to load in the webview.
     */
    loadUrl(newUrl: string, reason: string) {
        const defaultSearchAtom = getSettingsKeyAtom("web:defaultsearch");
        const searchTemplate = globalStore.get(defaultSearchAtom);
        const nextUrl = this.ensureUrlScheme(newUrl, searchTemplate);
        console.log("webview loadUrl", reason, nextUrl, "cur=", this.webviewRef.current.getURL());
        if (!this.webviewRef.current) {
            return;
        }
        if (this.webviewRef.current.getURL() != nextUrl) {
            fireAndForget(() => this.webviewRef.current.loadURL(nextUrl));
        }
        if (newUrl != nextUrl) {
            globalStore.set(this.url, nextUrl);
        }
    }

    /**
     * Load a new URL in the webview and return a promise.
     * @param newUrl The new URL to load in the webview.
     * @param reason The reason for loading the URL.
     * @returns Promise that resolves when the URL is loaded.
     */
    loadUrlPromise(newUrl: string, reason: string): Promise<void> {
        const defaultSearchAtom = getSettingsKeyAtom("web:defaultsearch");
        const searchTemplate = globalStore.get(defaultSearchAtom);
        const nextUrl = this.ensureUrlScheme(newUrl, searchTemplate);
        console.log("webview loadUrlPromise", reason, nextUrl, "cur=", this.webviewRef.current?.getURL());

        if (!this.webviewRef.current) {
            return Promise.reject(new Error("WebView ref not available"));
        }

        if (newUrl != nextUrl) {
            globalStore.set(this.url, nextUrl);
        }

        if (this.webviewRef.current.getURL() != nextUrl) {
            return this.webviewRef.current.loadURL(nextUrl);
        }

        return Promise.resolve();
    }

    /**
     * Get the current URL from the state.
     * @returns The URL from the state.
     */
    getUrl() {
        return globalStore.get(this.url);
    }

    setRefreshIcon(refreshIcon: string) {
        globalStore.set(this.refreshIcon, refreshIcon);
    }

    setIsLoading(isLoading: boolean) {
        globalStore.set(this.isLoading, isLoading);
    }

    async setHomepageUrl(url: string, scope: "global" | "block") {
        if (url != null && url != "") {
            switch (scope) {
                case "block":
                    await RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", this.blockId),
                        meta: { pinnedurl: url },
                    });
                    break;
                case "global":
                    await RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", this.blockId),
                        meta: { pinnedurl: "" },
                    });
                    await RpcApi.SetConfigCommand(TabRpcClient, { "web:defaulturl": url });
                    break;
            }
        }
    }

    giveFocus(): boolean {
        console.log("webview giveFocus");
        if (this.searchAtoms && globalStore.get(this.searchAtoms.isOpen)) {
            console.log("search is open, not giving focus");
            return true;
        }
        const ctrlShiftState = globalStore.get(getSimpleControlShiftAtom());
        if (ctrlShiftState) {
            // this is really weird, we don't get keyup events from webview
            const unsubFn = globalStore.sub(getSimpleControlShiftAtom(), () => {
                const state = globalStore.get(getSimpleControlShiftAtom());
                if (!state) {
                    unsubFn();
                    const isStillFocused = globalStore.get(this.nodeModel.isFocused);
                    if (isStillFocused) {
                        this.webviewRef.current?.focus();
                    }
                }
            });
            return false;
        }
        this.webviewRef.current?.focus();
        return true;
    }

    copyUrlToClipboard() {
        const url = this.getUrl();
        if (url != null && url != "") {
            fireAndForget(() => navigator.clipboard.writeText(url));
        }
    }

    clearHistory() {
        try {
            this.webviewRef.current?.clearHistory();
        } catch (e) {
            console.error("Failed to clear history", e);
        }
    }

    async clearCookiesAndStorage() {
        try {
            const webContentsId = this.webviewRef.current?.getWebContentsId();
            if (webContentsId) {
                await getApi().clearWebviewStorage(webContentsId);
            }
        } catch (e) {
            console.error("Failed to clear cookies and storage", e);
        }
    }

    // Q1 — Barra de progreso de carga
    setLoadProgress(progress: number) {
        globalStore.set(this.loadProgress, progress);
    }

    // Q3 — Leer en Voz Alta (Read Aloud)
    toggleReadAloud() {
        const isActive = globalStore.get(this.readAloudActive);
        if (isActive) {
            // Detener lectura
            fireAndForget(() =>
                this.webviewRef.current?.executeJavaScript("window.speechSynthesis.cancel(); true;")
            );
            globalStore.set(this.readAloudActive, false);
        } else {
            // Empezar a leer
            globalStore.set(this.readAloudActive, true);
            fireAndForget(() =>
                this.webviewRef.current
                    ?.executeJavaScript(
                        `(function() {
                            window.speechSynthesis.cancel();
                            var text = window.getSelection().toString() || document.body.innerText.substring(0, 5000);
                            var utterance = new SpeechSynthesisUtterance(text);
                            utterance.lang = document.documentElement.lang || 'es-ES';
                            utterance.onend = function() {};
                            window.speechSynthesis.speak(utterance);
                            return true;
                        })()`
                    )
                    .catch((e) => {
                        console.error("Read Aloud error:", e);
                        globalStore.set(this.readAloudActive, false);
                    })
            );
        }
    }

    // Q5 — Focus Mode (ocultar todo excepto el contenido principal)
    toggleFocusMode() {
        const focusModeCSS = `
            header, footer, nav, aside, .sidebar, .ads, .ad, .advertisement,
            [class*="banner"], [class*="popup"], [class*="modal"], [id*="cookie"],
            [class*="cookie"], [class*="newsletter"], [class*="subscribe"] {
                display: none !important;
            }
            body { max-width: 800px !important; margin: 0 auto !important; padding: 20px !important; }
            article, main, [role="main"] { display: block !important; width: 100% !important; }
        `;
        fireAndForget(() =>
            this.webviewRef.current?.executeJavaScript(
                `(function() {
                    var existingStyle = document.getElementById('gulin-focus-mode');
                    if (existingStyle) {
                        existingStyle.remove();
                        return 'off';
                    }
                    var style = document.createElement('style');
                    style.id = 'gulin-focus-mode';
                    style.textContent = ${JSON.stringify(focusModeCSS)};
                    document.head.appendChild(style);
                    return 'on';
                })()`
            )
        );
    }

    // Q6 — Enviar selección al terminal activo
    async sendSelectionToTerminal() {
        try {
            const selectedText = await this.webviewRef.current?.executeJavaScript(
                "window.getSelection().toString()"
            );
            if (selectedText && selectedText.trim() !== "") {
                await navigator.clipboard.writeText(selectedText.trim());
                console.log("Sent selection to clipboard for terminal:", selectedText.trim());
            }
        } catch (e) {
            console.error("Failed to send selection to terminal:", e);
        }
    }

    // #8 — Reader Mode
    toggleReaderMode() {
        fireAndForget(() => this.webviewRef.current?.executeJavaScript(toggleReaderModeScript()));
    }

    // Modo Oscuro Forzado
    toggleForcedDarkMode() {
        const isForced = globalStore.get(this.isDarkModeForced);
        const newState = !isForced;
        globalStore.set(this.isDarkModeForced, newState);
        const script = newState
            ? `(function() {
                var s = document.createElement('style');
                s.id = 'gulin-forced-dark';
                s.textContent = 'html { filter: invert(90%) hue-rotate(180deg) !important; background: #121212 !important; } img, video, iframe, canvas { filter: invert(100%) hue-rotate(180deg) !important; }';
                document.head.appendChild(s);
            })()`
            : `(function() {
                var s = document.getElementById('gulin-forced-dark');
                if (s) s.remove();
            })()`;
        fireAndForget(() => this.webviewRef.current?.executeJavaScript(script));
    }

    // Adblocker
    async toggleAdblock() {
        const current = globalStore.get(this.isAdblockEnabled);
        const next = !current;
        globalStore.set(this.isAdblockEnabled, next);
        await getApi().toggleAdblock(next);
        this.webviewRef.current?.reload();
    }

    // Web Clipper -> Markdown
    async clipPageToMarkdown() {
        try {
            const rawJson = await this.webviewRef.current?.executeJavaScript(getClipPageScript());
            if (rawJson) {
                const data = JSON.parse(rawJson);
                const markdown = formatAsMarkdown(data);
                const fileName = `nota_${Date.now()}.md`;
                await getApi().saveTextFile(fileName, markdown);
                alert(`Página guardada exitosamente como ${fileName}`);
            }
        } catch (e) {
            console.error("Error clipping page:", e);
        }
    }

    // Picture-in-Picture
    async triggerPiP() {
        const wcId = this.webviewRef.current?.getWebContentsId();
        if (wcId) {
            await getApi().webviewPip(wcId);
        }
    }

    // Tabs Management
    newTab(url?: string) {
        const targetUrl = url || "https://google.com";
        const newTabItem: WebTab = {
            id: `tab-${Date.now()}`,
            url: targetUrl,
            title: "Nueva pestaña",
        };
        const currentTabs = globalStore.get(this.tabsList);
        globalStore.set(this.tabsList, [...currentTabs, newTabItem]);
        globalStore.set(this.activeTabId, newTabItem.id);
        this.loadUrl(targetUrl, "new-tab");
    }

    closeTab(tabId: string) {
        const currentTabs = globalStore.get(this.tabsList);
        if (currentTabs.length <= 1) return;
        const newTabs = currentTabs.filter((t) => t.id !== tabId);
        globalStore.set(this.tabsList, newTabs);
        const activeId = globalStore.get(this.activeTabId);
        if (activeId === tabId) {
            const nextTab = newTabs[newTabs.length - 1];
            globalStore.set(this.activeTabId, nextTab.id);
            if (nextTab.url) this.loadUrl(nextTab.url, "tab-switch");
        }
    }

    selectTab(tabId: string) {
        const currentTabs = globalStore.get(this.tabsList);
        const target = currentTabs.find((t) => t.id === tabId);
        if (target) {
            globalStore.set(this.activeTabId, tabId);
            if (target.url && target.url !== this.getUrl()) {
                this.loadUrl(target.url, "tab-select");
            }
        }
    }

    // Bookmarks Management
    addBookmark(bookmark: Omit<BookmarkItem, "id" | "createdAt">) {
        const newItem: BookmarkItem = {
            ...bookmark,
            id: `bm-${Date.now()}`,
            createdAt: Date.now(),
        };
        const current = globalStore.get(this.bookmarksList);
        globalStore.set(this.bookmarksList, [newItem, ...current]);
    }

    removeBookmark(id: string) {
        const current = globalStore.get(this.bookmarksList);
        globalStore.set(this.bookmarksList, current.filter((b) => b.id !== id));
    }

    // Reading List Management
    addToReadingList() {
        const url = this.getUrl();
        const title = this.webviewRef.current?.getTitle?.() || url;
        const newItem: ReadingListItem = {
            id: `rl-${Date.now()}`,
            url,
            title,
            savedAt: Date.now(),
            isRead: false,
        };
        const current = globalStore.get(this.readingList);
        globalStore.set(this.readingList, [newItem, ...current]);
        alert("Artículo guardado en la Lista de Lectura 📚");
    }

    // Browser Agent Tool Executor (llamado por la IA)
    async runAgentTool(toolName: string, params: any): Promise<any> {
        globalStore.set(this.isBrowserAgentActive, true);
        globalStore.set(this.browserAgentAction, `${toolName}: ${JSON.stringify(params || {})}`);
        try {
            const result = await executeBrowserAgentTool(toolName, params, this);
            return result;
        } finally {
            setTimeout(() => {
                globalStore.set(this.isBrowserAgentActive, false);
                globalStore.set(this.browserAgentAction, "");
            }, 1000);
        }
    }

    async refreshWebMcpTools(): Promise<void> {
        try {
            const wcId = this.webviewRef.current?.getWebContentsId?.();
            if (!wcId) return;
            const tools = await getApi().webmcpGetTools(wcId);
            globalStore.set(this.webmcpTools, Array.isArray(tools) ? tools : []);
        } catch (e) {
            console.debug("WebMCP tools fetch error:", e);
        }
    }

    async executeWebMcpTool(toolName: string, params: any): Promise<any> {
        const wcId = this.webviewRef.current?.getWebContentsId?.();
        if (!wcId) throw new Error("No webview WebContents available");
        return await getApi().webmcpExecuteTool(wcId, toolName, params);
    }

    keyDownHandler(e: GulinKeyboardEvent): boolean {
        if (checkKeyPressed(e, "Cmd:l")) {
            this.urlInputRef?.current?.focus();
            this.urlInputRef?.current?.select();
            return true;
        }
        if (checkKeyPressed(e, "Cmd:r")) {
            this.webviewRef.current?.reload();
            return true;
        }
        if (checkKeyPressed(e, "Cmd:k")) {
            const cur = globalStore.get(this.isCommandPaletteOpen);
            globalStore.set(this.isCommandPaletteOpen, !cur);
            return true;
        }
        if (checkKeyPressed(e, "Cmd:Shift:k")) {
            const cur = globalStore.get(this.isQuickSwitcherOpen);
            globalStore.set(this.isQuickSwitcherOpen, !cur);
            return true;
        }
        if (checkKeyPressed(e, "Cmd:y")) {
            const cur = globalStore.get(this.isHistoryOpen);
            globalStore.set(this.isHistoryOpen, !cur);
            return true;
        }
        if (checkKeyPressed(e, "Cmd:Shift:r")) {
            this.toggleReaderMode();
            return true;
        }
        if (checkKeyPressed(e, "Cmd:t")) {
            this.newTab();
            return true;
        }
        if (checkKeyPressed(e, "Cmd:w")) {
            const tabs = globalStore.get(this.tabsList);
            if (tabs.length > 1) {
                const activeId = globalStore.get(this.activeTabId);
                this.closeTab(activeId);
                return true;
            }
        }
        if (checkKeyPressed(e, "Cmd:ArrowLeft")) {
            this.handleBack(null);
            return true;
        }
        if (checkKeyPressed(e, "Cmd:ArrowRight")) {
            this.handleForward(null);
            return true;
        }
        if (checkKeyPressed(e, "Cmd:o")) {
            fireAndForget(this.handleOpenLocalFile.bind(this));
            return true;
        }
        if (checkKeyPressed(e, "Cmd:Shift:o") || checkKeyPressed(e, "Cmd:b")) {
            const curVal = globalStore.get(this.typeaheadOpen);
            globalStore.set(this.typeaheadOpen, !curVal);
            return true;
        }
        return false;
    }

    setZoomFactor(factor: number | null) {
        // null is ok (will reset to default)
        if (factor != null && factor < 0.1) {
            factor = 0.1;
        }
        if (factor != null && factor > 5) {
            factor = 5;
        }
        const domReady = globalStore.get(this.domReady);
        if (!domReady) {
            return;
        }
        this.webviewRef.current?.setZoomFactor(factor || 1);
        RpcApi.SetMetaCommand(TabRpcClient, {
            oref: WOS.makeORef("block", this.blockId),
            meta: { "web:zoom": factor }, // allow null so we can remove the zoom factor here
        });
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        const zoomSubMenu: ContextMenuItem[] = [];
        let curZoom = 1;
        if (globalStore.get(this.domReady)) {
            curZoom = this.webviewRef.current?.getZoomFactor() || 1;
        }
        const makeZoomFactorMenuItem = (label: string, factor: number): ContextMenuItem => {
            return {
                label: label,
                type: "checkbox",
                click: () => {
                    this.setZoomFactor(factor);
                },
                checked: curZoom == factor,
            };
        };
        zoomSubMenu.push({
            label: "Reset",
            click: () => {
                this.setZoomFactor(null);
            },
        });
        zoomSubMenu.push(makeZoomFactorMenuItem("25%", 0.25));
        zoomSubMenu.push(makeZoomFactorMenuItem("50%", 0.5));
        zoomSubMenu.push(makeZoomFactorMenuItem("70%", 0.7));
        zoomSubMenu.push(makeZoomFactorMenuItem("80%", 0.8));
        zoomSubMenu.push(makeZoomFactorMenuItem("90%", 0.9));
        zoomSubMenu.push(makeZoomFactorMenuItem("100%", 1));
        zoomSubMenu.push(makeZoomFactorMenuItem("110%", 1.1));
        zoomSubMenu.push(makeZoomFactorMenuItem("120%", 1.2));
        zoomSubMenu.push(makeZoomFactorMenuItem("130%", 1.3));
        zoomSubMenu.push(makeZoomFactorMenuItem("150%", 1.5));
        zoomSubMenu.push(makeZoomFactorMenuItem("175%", 1.75));
        zoomSubMenu.push(makeZoomFactorMenuItem("200%", 2));

        // User Agent Type submenu
        const curUserAgentType = globalStore.get(this.userAgentType) || "default";
        const userAgentSubMenu: ContextMenuItem[] = [
            {
                label: "Default",
                type: "checkbox",
                click: () => {
                    fireAndForget(() => {
                        return RpcApi.SetMetaCommand(TabRpcClient, {
                            oref: WOS.makeORef("block", this.blockId),
                            meta: { "web:useragenttype": null },
                        });
                    });
                },
                checked: curUserAgentType === "default" || curUserAgentType === "",
            },
            {
                label: "Mobile: iPhone",
                type: "checkbox",
                click: () => {
                    fireAndForget(() => {
                        return RpcApi.SetMetaCommand(TabRpcClient, {
                            oref: WOS.makeORef("block", this.blockId),
                            meta: { "web:useragenttype": "mobile:iphone" },
                        });
                    });
                },
                checked: curUserAgentType === "mobile:iphone",
            },
            {
                label: "Mobile: Android",
                type: "checkbox",
                click: () => {
                    fireAndForget(() => {
                        return RpcApi.SetMetaCommand(TabRpcClient, {
                            oref: WOS.makeORef("block", this.blockId),
                            meta: { "web:useragenttype": "mobile:android" },
                        });
                    });
                },
                checked: curUserAgentType === "mobile:android",
            },
        ];

        const isNavHidden = globalStore.get(this.hideNav);
        return [
            {
                label: "Abrir archivo HTML local...",
                click: () => fireAndForget(this.handleOpenLocalFile.bind(this)),
            },
            {
                label: "Copy URL to Clipboard",
                click: () => this.copyUrlToClipboard(),
            },
            {
                label: "Enviar URL al Chat de IA",
                click: () => {
                    const currentUrl = this.getUrl();
                    if (currentUrl) {
                        try {
                            const aiModel = GulinAIModel.getInstance();
                            globalStore.set(aiModel.inputAtom, `[Contexto web: ${currentUrl}]\n`);
                        } catch (e) {
                            console.warn("No se pudo enviar al chat de IA:", e);
                        }
                    }
                },
            },
            {
                label: "Enviar selección al Terminal",
                click: () => fireAndForget(() => this.sendSelectionToTerminal()),
            },
            {
                label: "⚡ Paleta de Comandos (Cmd+K)",
                click: () => {
                    const isOpen = globalStore.get(this.isCommandPaletteOpen);
                    globalStore.set(this.isCommandPaletteOpen, !isOpen);
                },
            },
            {
                label: "📖 Modo Lector (Reader Mode)",
                click: () => this.toggleReaderMode(),
            },
            {
                label: "🌙 Modo Oscuro Forzado",
                click: () => this.toggleForcedDarkMode(),
            },
            {
                label: "🚫 Bloqueador de Anuncios",
                type: "checkbox",
                checked: globalStore.get(this.isAdblockEnabled),
                click: () => fireAndForget(() => this.toggleAdblock()),
            },
            {
                label: "📝 Guardar página como Nota Markdown",
                click: () => fireAndForget(() => this.clipPageToMarkdown()),
            },
            {
                label: "📚 Guardar en Lista de Lectura",
                click: () => this.addToReadingList(),
            },
            {
                label: "📺 Picture-in-Picture (Video)",
                click: () => fireAndForget(() => this.triggerPiP()),
            },
            {
                label: "🗂️ Nueva Pestaña Interna",
                click: () => this.newTab(),
            },
            {
                type: "separator",
            },
            {
                label: "⭐ Ver Marcadores / Favoritos",
                click: () => {
                    const isOpen = globalStore.get(this.isBookmarksOpen);
                    globalStore.set(this.isBookmarksOpen, !isOpen);
                },
            },
            {
                label: "🕒 Ver Historial de Navegación",
                click: () => {
                    const isOpen = globalStore.get(this.isHistoryOpen);
                    globalStore.set(this.isHistoryOpen, !isOpen);
                },
            },
            {
                label: "📥 Ver Descargas",
                click: () => {
                    const isOpen = globalStore.get(this.isDownloadsOpen);
                    globalStore.set(this.isDownloadsOpen, !isOpen);
                },
            },
            {
                type: "separator",
            },
            {
                label: "User Agent Type",
                submenu: userAgentSubMenu,
            },
            {
                type: "separator",
            },
            {
                label: isNavHidden ? "Un-Hide Navigation" : "Hide Navigation",
                click: () =>
                    fireAndForget(() => {
                        return RpcApi.SetMetaCommand(TabRpcClient, {
                            oref: WOS.makeORef("block", this.blockId),
                            meta: { "web:hidenav": !isNavHidden },
                        });
                    }),
            },
            {
                label: "Set Zoom Factor",
                submenu: zoomSubMenu,
            },
            {
                label: this.webviewRef.current?.isDevToolsOpened() ? "Close DevTools" : "Open DevTools",
                click: () => {
                    if (this.webviewRef.current) {
                        if (this.webviewRef.current.isDevToolsOpened()) {
                            this.webviewRef.current.closeDevTools();
                        } else {
                            this.webviewRef.current.openDevTools();
                        }
                    }
                },
            },
            {
                type: "separator",
            },
            {
                label: "Clear History",
                click: () => this.clearHistory(),
            },
            {
                label: "Clear Cookies and Storage (All Web Widgets)",
                click: () => fireAndForget(() => this.clearCookiesAndStorage()),
            },
        ];
    }
}

const BookmarkTypeahead = memo(
    ({ model, blockRef }: { model: WebViewModel; blockRef: React.RefObject<HTMLDivElement> }) => {
        const openBookmarksJson = () => {
            fireAndForget(async () => {
                const path = `${getApi().getConfigDir()}/presets/bookmarks.json`;
                const blockDef: BlockDef = {
                    meta: {
                        view: "preview",
                        file: path,
                    },
                };
                await createBlock(blockDef, false, true);
                model.setTypeaheadOpen(false);
            });
        };
        return (
            <BlockHeaderSuggestionControl
                blockRef={blockRef}
                openAtom={model.typeaheadOpen}
                onClose={() => model.setTypeaheadOpen(false)}
                onSelect={(suggestion) => {
                    if (suggestion == null || suggestion.type != "url") {
                        return true;
                    }
                    model.loadUrl(suggestion["url:url"], "bookmark-typeahead");
                    return true;
                }}
                fetchSuggestions={model.fetchBookmarkSuggestions}
                placeholderText="Open Bookmark..."
            >
                <SuggestionControlNoData>
                    <div className="text-center">
                        <p className="text-lg font-bold text-gray-100">No Bookmarks Configured</p>
                        <p className="text-sm text-gray-400 mt-1">
                            Edit your <code className="font-mono">bookmarks.json</code> file to configure bookmarks.
                        </p>
                        <button
                            onClick={openBookmarksJson}
                            className="mt-3 px-4 py-2 text-sm font-medium text-black bg-accent hover:bg-accenthover rounded-lg cursor-pointer"
                        >
                            Open bookmarks.json
                        </button>
                    </div>
                </SuggestionControlNoData>

                <SuggestionControlNoResults>
                    <div className="text-center">
                        <p className="text-sm text-gray-400">No matching bookmarks</p>
                        <button
                            onClick={openBookmarksJson}
                            className="mt-3 px-4 py-2 text-sm font-medium text-black bg-accent hover:bg-accenthover rounded-lg cursor-pointer"
                        >
                            Edit bookmarks.json
                        </button>
                    </div>
                </SuggestionControlNoResults>
            </BlockHeaderSuggestionControl>
        );
    }
);

interface WebViewProps {
    blockId: string;
    model: WebViewModel;
    onFailLoad?: (url: string) => void;
    blockRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    initialSrc?: string;
}

const WebView = memo(({ model, onFailLoad, blockRef, initialSrc }: WebViewProps) => {
    const blockData = useAtomValue(model.blockAtom);
    const defaultUrl = useAtomValue(model.homepageUrl);
    const defaultSearchAtom = getSettingsKeyAtom("web:defaultsearch");
    const defaultSearch = useAtomValue(defaultSearchAtom);
    let metaUrl = blockData?.meta?.url || defaultUrl;
    metaUrl = model.ensureUrlScheme(metaUrl, defaultSearch);
    const metaUrlRef = useRef(metaUrl);
    const isMagnified = useAtomValue(model.nodeModel.isMagnified);
    const baseZoomFactor = useAtomValue(getBlockMetaKeyAtom(model.blockId, "web:zoom")) || 1;
    const zoomFactor = isMagnified ? baseZoomFactor * 1.3 : baseZoomFactor;
    const partitionOverride = useAtomValueSafe(model.partitionOverride);
    const metaPartition = useAtomValue(getBlockMetaKeyAtom(model.blockId, "web:partition"));
    const webPartition = partitionOverride || metaPartition || "persist:gulin-web";
    const userAgentType = useAtomValue(model.userAgentType) || "default";

    // Determine user agent string based on type (genuine Chrome avoids anti-bot CAPTCHA)
    let userAgent: string = USER_AGENT_DESKTOP;
    if (userAgentType === "mobile:iphone") {
        userAgent = USER_AGENT_IPHONE;
    } else if (userAgentType === "mobile:android") {
        userAgent = USER_AGENT_ANDROID;
    }

    // Search
    const searchProps = useSearch({ anchorRef: model.webviewRef, viewModel: model });
    const searchVal = useAtomValue<string>(searchProps.searchValue);
    const setSearchIndex = useSetAtom(searchProps.resultsIndex);
    const setNumSearchResults = useSetAtom(searchProps.resultsCount);
    searchProps.onSearch = useCallback((search: string) => {
        if (!globalStore.get(model.domReady)) {
            return;
        }
        try {
            if (search) {
                model.webviewRef.current?.findInPage(search, { findNext: true });
            } else {
                model.webviewRef.current?.stopFindInPage("clearSelection");
            }
        } catch (e) {
            console.error("Failed to search", e);
        }
    }, []);
    searchProps.onNext = useCallback(() => {
        if (!globalStore.get(model.domReady)) {
            return;
        }
        try {
            console.log("search next", searchVal);
            model.webviewRef.current?.findInPage(searchVal, { findNext: false, forward: true });
        } catch (e) {
            console.error("Failed to search next", e);
        }
    }, [searchVal]);
    searchProps.onPrev = useCallback(() => {
        if (!globalStore.get(model.domReady)) {
            return;
        }
        try {
            console.log("search prev", searchVal);
            model.webviewRef.current?.findInPage(searchVal, { findNext: false, forward: false });
        } catch (e) {
            console.error("Failed to search prev", e);
        }
    }, [searchVal]);
    const onFoundInPage = useCallback((event: any) => {
        const result = event.result;
        console.log("found in page", result);
        if (!result) {
            return;
        }
        setNumSearchResults(result.matches);
        setSearchIndex(result.activeMatchOrdinal - 1);
    }, []);
    // End Search

    // The initial value of the block metadata URL when the component first renders. Used to set the starting src value for the webview.
    const [metaUrlInitial] = useState(initialSrc || metaUrl);
    const prevUserAgentTypeRef = useRef(userAgentType);

    const [webContentsId, setWebContentsId] = useState(null);
    const domReady = useAtomValue(model.domReady);

    const [errorText, setErrorText] = useState("");

    function setBgColor() {
        const webview = model.webviewRef.current;
        if (!webview) {
            return;
        }
        setTimeout(() => {
            webview
                .executeJavaScript(
                    `!!document.querySelector('meta[name="color-scheme"]') && document.querySelector('meta[name="color-scheme"]').content?.includes('dark') || false`
                )
                .then((hasDarkMode) => {
                    if (hasDarkMode) {
                        webview.style.backgroundColor = "black"; // Dark mode background
                    } else {
                        webview.style.backgroundColor = "white"; // Light mode background
                    }
                })
                .catch((e) => {
                    webview.style.backgroundColor = "black"; // Dark mode background
                    console.log("Error getting color scheme, defaulting to dark", e);
                });
        }, 100);
    }

    useEffect(() => {
        return () => {
            globalStore.set(model.domReady, false);
        };
    }, []);

    useEffect(() => {
        if (model.webviewRef.current == null || !domReady) {
            return;
        }
        try {
            const wcId = model.webviewRef.current.getWebContentsId?.();
            if (wcId) {
                setWebContentsId(wcId);
                if (model.webviewRef.current.getZoomFactor() != zoomFactor) {
                    model.webviewRef.current.setZoomFactor(zoomFactor);
                }
            }
        } catch (e) {
            console.error("Failed to get webcontentsid / setzoomlevel (webview)", e);
        }
    }, [model.webviewRef.current, domReady, zoomFactor]);

    // Load a new URL if the block metadata is updated.
    useEffect(() => {
        if (initialSrc) {
            // Skip URL loading if initialSrc is provided (it's already loaded via src attribute)
            return;
        }
        if (metaUrlRef.current != metaUrl) {
            metaUrlRef.current = metaUrl;
            model.loadUrl(metaUrl, "meta");
        }
    }, [metaUrl, initialSrc]);

    // Reload webview when user agent type changes
    useEffect(() => {
        if (prevUserAgentTypeRef.current !== userAgentType && domReady && model.webviewRef.current) {
            let newUserAgent: string = USER_AGENT_DESKTOP;
            if (userAgentType === "mobile:iphone") {
                newUserAgent = USER_AGENT_IPHONE;
            } else if (userAgentType === "mobile:android") {
                newUserAgent = USER_AGENT_ANDROID;
            }

            model.webviewRef.current.setUserAgent(newUserAgent);
            model.webviewRef.current.reload();
        }
        prevUserAgentTypeRef.current = userAgentType;
    }, [userAgentType, domReady]);

    useEffect(() => {
        const webview = model.webviewRef.current;
        if (!webview) {
            return;
        }
        const navigateListener = (e: any) => {
            setErrorText("");
            if (e.isMainFrame) {
                model.handleNavigate(e.url);
            }
        };
        const newWindowHandler = (e: any) => {
            e.preventDefault();
            const newUrl = e.detail.url;
            fireAndForget(() => openLink(newUrl, true));
        };
        const startLoadingHandler = () => {
            model.setRefreshIcon("xmark-large");
            model.setIsLoading(true);
            model.setLoadProgress(10);
            webview.style.backgroundColor = "transparent";
            // Simular progreso gradual hasta 90% mientras carga
            let progress = 10;
            const interval = setInterval(() => {
                progress = Math.min(progress + Math.random() * 15, 90);
                model.setLoadProgress(Math.round(progress));
            }, 400);
            (webview as any)._progressInterval = interval;
        };
        const stopLoadingHandler = () => {
            model.setRefreshIcon("rotate-right");
            model.setIsLoading(false);
            // Completar la barra de progreso y luego ocultarla
            model.setLoadProgress(100);
            clearInterval((webview as any)._progressInterval);
            setTimeout(() => model.setLoadProgress(0), 400);
            setBgColor();
            model.refreshWebMcpTools();
        };
        const failLoadHandler = (e: any) => {
            if (e.errorCode === -3) {
                console.warn("Suppressed ERR_ABORTED error", e);
            } else {
                const errorMessage = `Failed to load ${e.validatedURL}: ${e.errorDescription}`;
                console.error(errorMessage);
                setErrorText(errorMessage);
                if (onFailLoad) {
                    const curUrl = model.webviewRef.current.getURL();
                    onFailLoad(curUrl);
                }
            }
        };
        const webviewFocus = () => {
            getApi().setWebviewFocus(webview.getWebContentsId());
            model.nodeModel.focusNode();
        };
        const webviewBlur = () => {
            getApi().setWebviewFocus(null);
        };
        const handleDomReady = () => {
            globalStore.set(model.domReady, true);
            setBgColor();
            const wcId = webview.getWebContentsId?.();
            if (wcId) {
                getApi().enableWebviewDownloads?.(wcId);
                model.refreshWebMcpTools();
            }
        };
        const handleMediaPlaying = () => {
            model.setMediaPlaying(true);
        };
        const handleMediaPaused = () => {
            model.setMediaPlaying(false);
        };

        // Listen for download IPC events (inside useEffect so we can properly clean up)
        const handleDownloadStarted = (_: any, dl: any) => {
            const current = globalStore.get(model.downloadsList);
            globalStore.set(model.downloadsList, [dl, ...current]);
            globalStore.set(model.isDownloadsOpen, true);
        };
        const handleDownloadUpdated = (_: any, dl: any) => {
            const current = globalStore.get(model.downloadsList);
            globalStore.set(
                model.downloadsList,
                current.map((item) => (item.id === dl.id ? { ...item, ...dl } : item))
            );
        };
        const handleDownloadDone = (_: any, dl: any) => {
            const current = globalStore.get(model.downloadsList);
            globalStore.set(
                model.downloadsList,
                current.map((item) => (item.id === dl.id ? { ...item, ...dl } : item))
            );
        };
        const ipcRenderer = (window as any).__ipcRenderer || (getApi() as any)._ipcRenderer;
        if (ipcRenderer) {
            ipcRenderer.on("download-started", handleDownloadStarted);
            ipcRenderer.on("download-updated", handleDownloadUpdated);
            ipcRenderer.on("download-done", handleDownloadDone);
        } else {
            // Fallback: register via getApi() wrappers (no cleanup possible, but acceptable)
            getApi().onDownloadStarted?.((dl: any) => handleDownloadStarted(null, dl));
            getApi().onDownloadUpdated?.((dl: any) => handleDownloadUpdated(null, dl));
            getApi().onDownloadDone?.((dl: any) => handleDownloadDone(null, dl));
        }

        webview.addEventListener("did-frame-navigate", navigateListener);
        webview.addEventListener("did-navigate-in-page", navigateListener);
        webview.addEventListener("did-navigate", navigateListener);
        webview.addEventListener("did-start-loading", startLoadingHandler);
        webview.addEventListener("did-stop-loading", stopLoadingHandler);
        webview.addEventListener("new-window", newWindowHandler);
        webview.addEventListener("did-fail-load", failLoadHandler);
        webview.addEventListener("focus", webviewFocus);
        webview.addEventListener("blur", webviewBlur);
        webview.addEventListener("dom-ready", handleDomReady);
        webview.addEventListener("media-started-playing", handleMediaPlaying);
        webview.addEventListener("media-paused", handleMediaPaused);
        webview.addEventListener("found-in-page", onFoundInPage);

        // Clean up event listeners on component unmount
        return () => {
            webview.removeEventListener("did-frame-navigate", navigateListener);
            webview.removeEventListener("did-navigate", navigateListener);
            webview.removeEventListener("did-navigate-in-page", navigateListener);
            webview.removeEventListener("new-window", newWindowHandler);
            webview.removeEventListener("did-fail-load", failLoadHandler);
            webview.removeEventListener("did-start-loading", startLoadingHandler);
            webview.removeEventListener("did-stop-loading", stopLoadingHandler);
            webview.removeEventListener("focus", webviewFocus);
            webview.removeEventListener("blur", webviewBlur);
            webview.removeEventListener("dom-ready", handleDomReady);
            webview.removeEventListener("media-started-playing", handleMediaPlaying);
            webview.removeEventListener("media-paused", handleMediaPaused);
            webview.removeEventListener("found-in-page", onFoundInPage);
            if (ipcRenderer) {
                ipcRenderer.removeListener("download-started", handleDownloadStarted);
                ipcRenderer.removeListener("download-updated", handleDownloadUpdated);
                ipcRenderer.removeListener("download-done", handleDownloadDone);
            }
        };
    }, []);

        // Bug fix: use reactive hooks so panels update when atoms change (no globalStore.get in JSX)
        const tabsList = useAtomValue(model.tabsList);
        const bookmarksList = useAtomValue(model.bookmarksList);
        const historyList = useAtomValue(model.historyList);
        const currentUrl = useAtomValue(model.url) || metaUrl;

        const handleDragOver = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handleDrop = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                // @ts-expect-error Electron File object has 'path' property
                const filePath = file.path || file.name;
                if (filePath) {
                    const normalizedPath = filePath.replace(/\\/g, "/");
                    const fileUrl = normalizedPath.startsWith("/") ? `file://${normalizedPath}` : `file:///${normalizedPath}`;
                    model.loadUrl(fileUrl, "drag-drop");
                }
            }
        };

        return (
            <div className="webview-container relative h-full w-full flex flex-col" onDragOver={handleDragOver} onDrop={handleDrop}>
                {/* #1 — Tabs internos dentro del navegador */}
                <WebviewTabbar
                    tabsAtom={model.tabsList}
                    activeTabIdAtom={model.activeTabId}
                    onSelectTab={(id) => model.selectTab(id)}
                    onCloseTab={(id) => model.closeTab(id)}
                    onNewTab={() => model.newTab()}
                />

                <div className="relative flex-1 w-full h-full overflow-hidden">
                    {/* Q1 — Barra de progreso de carga */}
                    <WebviewProgressBar model={model} />

                    <webview
                        id="webview"
                        className="webview"
                        ref={model.webviewRef}
                        src={metaUrlInitial}
                        data-blockid={model.blockId}
                        data-webcontentsid={webContentsId} // needed for emain
                        preload={getWebviewPreloadUrl()}
                        // @ts-expect-error This is a discrepancy between the React typing and the Chromium impl for webviewTag. Chrome webviewTag expects a string, while React expects a boolean.
                        allowpopups="true"
                        partition={webPartition}
                        useragent={userAgent}
                    />

                    {/* FASE 2.4 — Browser Agent Overlay */}
                    <BrowserAgentOverlay
                        isActiveAtom={model.isBrowserAgentActive}
                        currentActionAtom={model.browserAgentAction}
                        onStop={() => globalStore.set(model.isBrowserAgentActive, false)}
                    />

                    {/* W3C WebMCP Standard Badge & Tool Inspector */}
                    <WebMCPBadge
                        toolsAtom={model.webmcpTools}
                        isOpenAtom={model.isWebMcpPopoverOpen}
                        onExecuteTool={(name, p) => model.executeWebMcpTool(name, p)}
                    />

                    {/* #10 — Command Palette (Cmd+K) */}
                    <WebviewCommandPalette
                        isOpenAtom={model.isCommandPaletteOpen}
                        currentUrl={metaUrl}
                        onNavigate={(u) => model.loadUrl(u, "palette")}
                        onCopyUrl={() => model.copyUrlToClipboard()}
                        onOpenDevTools={() => model.webviewRef.current?.openDevTools()}
                        onToggleReaderMode={() => model.toggleReaderMode()}
                        onToggleFocusMode={() => model.toggleFocusMode()}
                        onSendToChat={() => {
                            const u = model.getUrl();
                            if (u) {
                                const ai = GulinAIModel.getInstance();
                                globalStore.set(ai.inputAtom, `[Contexto web: ${u}]\n`);
                            }
                        }}
                        onToggleDarkMode={() => model.toggleForcedDarkMode()}
                        onToggleAdblock={() => fireAndForget(() => model.toggleAdblock())}
                        onOpenHistory={() => globalStore.set(model.isHistoryOpen, true)}
                        onOpenBookmarks={() => globalStore.set(model.isBookmarksOpen, true)}
                        onOpenDownloads={() => globalStore.set(model.isDownloadsOpen, true)}
                    />

                    {/* #3 — Panel de Historial (Cmd+Y) */}
                    <WebHistoryPanel
                        isOpenAtom={model.isHistoryOpen}
                        historyAtom={model.historyList}
                        onNavigate={(u) => model.loadUrl(u, "history")}
                        onClear={() => globalStore.set(model.historyList, [])}
                    />

                    {/* #4 — Panel de Marcadores / Favoritos */}
                    <WebviewBookmarks
                        isOpenAtom={model.isBookmarksOpen}
                        bookmarksAtom={model.bookmarksList}
                        currentUrl={currentUrl}
                        currentTitle={currentUrl}
                        onNavigate={(u) => model.loadUrl(u, "bookmark")}
                        onAdd={(b) => model.addBookmark(b)}
                        onRemove={(id) => model.removeBookmark(id)}
                    />

                    {/* #11 — Lista de Lectura (Reading List) */}
                    <ReadingList
                        isOpenAtom={model.isReadingListOpen}
                        itemsAtom={model.readingList}
                        onNavigate={(u) => model.loadUrl(u, "reading-list")}
                        onToggleRead={(id) => {
                            const list = globalStore.get(model.readingList);
                            globalStore.set(
                                model.readingList,
                                list.map((x) => (x.id === id ? { ...x, isRead: !x.isRead } : x))
                            );
                        }}
                        onRemove={(id) => {
                            const list = globalStore.get(model.readingList);
                            globalStore.set(model.readingList, list.filter((x) => x.id !== id));
                        }}
                    />

                    {/* #2 — Gestor de Descargas (Download Manager) */}
                    <DownloadManager
                        isOpenAtom={model.isDownloadsOpen}
                        downloadsAtom={model.downloadsList}
                        onOpenFile={(p) => getApi().openDownloadFile(p)}
                        onShowInFinder={(p) => getApi().showDownloadInFinder(p)}
                        onClearCompleted={() => {
                            const list = globalStore.get(model.downloadsList);
                            globalStore.set(
                                model.downloadsList,
                                list.filter((d) => d.state !== "completed")
                            );
                        }}
                    />

                    {/* Q15 — Quick Switcher (Cmd+Shift+K) — usa atoms reactivos */}
                    <WebviewQuickSwitcher
                        isOpenAtom={model.isQuickSwitcherOpen}
                        items={[
                            ...tabsList.map((t) => ({
                                type: "tab" as const,
                                id: t.id,
                                url: t.url,
                                title: t.title,
                            })),
                            ...bookmarksList.map((b) => ({
                                type: "bookmark" as const,
                                id: b.id,
                                url: b.url,
                                title: b.title,
                            })),
                            ...historyList.slice(0, 15).map((h) => ({
                                type: "history" as const,
                                id: h.url,
                                url: h.url,
                                title: h.title,
                            })),
                        ]}
                        onSelect={(item) => model.loadUrl(item.url, "switcher")}
                    />

                    {errorText && (
                        <div className="webview-error">
                            <div>{errorText}</div>
                        </div>
                    )}
                    <Search {...searchProps} />
                    <BookmarkTypeahead model={model} blockRef={blockRef} />
                </div>
            </div>
        );
});

// Q1 — Componente de la barra de progreso de carga
const WebviewProgressBar = memo(({ model }: { model: WebViewModel }) => {
    const loadProgress = useAtomValue(model.loadProgress);
    if (loadProgress <= 0 || loadProgress >= 100) return null;
    return (
        <div
            className="webview-progress-bar"
            style={{ width: `${loadProgress}%` }}
        />
    );
});
WebviewProgressBar.displayName = "WebviewProgressBar";

export { WebView };
