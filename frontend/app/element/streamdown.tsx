// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { CopyButton } from "@/app/element/copybutton";
import { IconButton } from "@/app/element/iconbutton";
import { cn, useAtomValueSafe, stringToBase64 } from "@/util/util";
import { getFocusedBlockId, getAllBlockComponentModels, getBlockComponentModel, refocusNode, openLink, getApi, createBlock } from "@/app/store/global";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { RpcApi } from "@/app/store/wshclientapi";
import type { Atom } from "jotai";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bundledLanguages, codeToHtml } from "shiki/bundle/web";
import { Streamdown } from "streamdown";
import { throttle } from "throttle-debounce";
import {
    InfraGridWidget,
    ExecutionPlanWidget,
    SlaReportWidget,
    KpiSummaryWidget,
    StatusBadge,
} from "@/app/aipanel/aiops-widgets";

const ShikiTheme = "github-dark-high-contrast";

function extractText(node: React.ReactNode): string {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractText).join("");
    // @ts-expect-error props exists on ReactElement
    if (typeof node === "object" && node.props) return extractText(node.props.children);
    return "";
}

const KNOWN_FILE_EXTENSIONS = new Set([
    "html", "htm", "json", "csv", "tsv", "log", "txt", "md", "markdown",
    "pdf", "png", "jpg", "jpeg", "gif", "svg", "webp", "ico",
    "sql", "sh", "bash", "zsh", "py", "ts", "tsx", "js", "jsx", "go", "rs",
    "yaml", "yml", "xml", "css", "scss", "env", "toml", "ini", "conf", "proto",
    "tar", "gz", "zip", "rar", "7z", "doc", "docx", "xls", "xlsx", "ppt", "pptx"
]);

function getFileIconByPath(path: string): string {
    const lower = path.toLowerCase();
    if (lower.endsWith(".html") || lower.endsWith(".htm")) return "fa-solid fa-file-code text-teal-400";
    if (lower.endsWith(".pdf")) return "fa-solid fa-file-pdf text-rose-400";
    if (lower.endsWith(".json") || lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".xml") || lower.endsWith(".toml")) return "fa-solid fa-file-lines text-amber-400";
    if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "fa-solid fa-file-csv text-emerald-400";
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".svg") || lower.endsWith(".webp")) return "fa-solid fa-file-image text-purple-400";
    if (lower.endsWith(".sh") || lower.endsWith(".bash") || lower.endsWith(".zsh") || lower.endsWith(".py") || lower.endsWith(".ts") || lower.endsWith(".js") || lower.endsWith(".go") || lower.endsWith(".rs") || lower.endsWith(".sql")) return "fa-solid fa-file-code text-green-400";
    if (lower.endsWith(".log") || lower.endsWith(".txt") || lower.endsWith(".md")) return "fa-solid fa-file-lines text-zinc-300";
    if (lower.endsWith(".zip") || lower.endsWith(".tar") || lower.endsWith(".gz") || lower.endsWith(".rar") || lower.endsWith(".7z")) return "fa-solid fa-file-zipper text-yellow-400";
    return "fa-solid fa-file text-teal-300";
}

function getPathOrUrlInfo(rawText: string): { isLink: boolean; type: "url" | "file" | "dir"; target: string; icon: string } | null {
    if (!rawText) return null;
    const text = rawText.trim();

    if (text.includes("\n") || text.length > 500 || text.length < 2) return null;
    if (/^--?[a-zA-Z0-9_-]+(=.*)?$/.test(text)) return null;

    // Web URLs
    if (/^https?:\/\/[^\s]+$/i.test(text)) {
        return { isLink: true, type: "url", target: text, icon: "fa-solid fa-globe text-cyan-400" };
    }

    // File URIs
    if (/^file:\/\/[^\s]+$/i.test(text)) {
        const clean = decodeURIComponent(text.replace(/^file:\/\//, ""));
        return { isLink: true, type: "file", target: clean, icon: getFileIconByPath(clean) };
    }

    // Absolute Unix paths or home paths (~/...)
    const isAbsoluteUnix = text.startsWith("/") && !text.includes(" ") && text.length > 1;
    const isHomePath = text.startsWith("~/") && text.length > 2;
    const isWindowsPath = /^[a-zA-Z]:[\\/][^\s]+$/.test(text);

    // Relative path with directory separator
    const isRelativePath = /^(\.\/|\.\.\/|[a-zA-Z0-9_-]+\/)[^\s]+$/.test(text);

    // Common file extensions
    const fileExtMatch = text.match(/\.([a-zA-Z0-9]+)(?:[#?].*)?$/);
    const hasKnownExt = fileExtMatch && KNOWN_FILE_EXTENSIONS.has(fileExtMatch[1].toLowerCase());

    if (isAbsoluteUnix || isHomePath || isWindowsPath || isRelativePath || hasKnownExt) {
        if (/^\d+\/\d+$/.test(text)) return null;
        if (/^\/[^/]+\/[gimsuy]*$/.test(text)) return null;

        const isDir = text.endsWith("/") || text.endsWith("\\");
        return {
            isLink: true,
            type: isDir ? "dir" : "file",
            target: text,
            icon: isDir ? "fa-solid fa-folder text-amber-400" : getFileIconByPath(text),
        };
    }

    return null;
}

export async function openPathInGulin(targetPath: string) {
    if (!targetPath) return;
    let cleanPath = targetPath.trim();
    if (cleanPath.startsWith("file://")) {
        cleanPath = decodeURIComponent(cleanPath.replace(/^file:\/\//, ""));
    }

    const lower = cleanPath.toLowerCase();
    const isHtmlFile = lower.endsWith(".html") || lower.endsWith(".htm") || lower.endsWith(".xhtml");

    if (isHtmlFile) {
        // Los reportes y archivos HTML se abren directamente en el navegador del sistema
        getApi().openNativePath(cleanPath);
        return;
    }

    try {
        const blockDef: BlockDef = {
            meta: {
                view: "preview",
                file: cleanPath,
                connection: "local",
            },
        };
        await createBlock(blockDef, false, true);
    } catch (e) {
        console.error("Failed to open path in Gulin editor widget, falling back to native:", e);
        getApi().openNativePath(cleanPath);
    }
}

function ClickablePathBadge({
    text,
    info,
    className = "",
}: {
    text: string;
    info: { isLink: boolean; type: "url" | "file" | "dir"; target: string; icon: string };
    className?: string;
}) {
    const [openedState, setOpenedState] = useState(false);

    const lowerTarget = (info.target || "").toLowerCase();
    const isHtmlFile =
        info.type === "file" &&
        (lowerTarget.endsWith(".html") ||
            lowerTarget.endsWith(".htm") ||
            lowerTarget.endsWith(".xhtml"));

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (info.type === "url") {
            openLink(info.target);
        } else {
            openPathInGulin(info.target);
        }

        setOpenedState(true);
        setTimeout(() => setOpenedState(false), 2000);
    };

    const tooltipTitle =
        info.type === "url"
            ? `Click para abrir enlace web: ${info.target}`
            : isHtmlFile
            ? `Click para abrir reporte HTML en el navegador: ${info.target}`
            : info.type === "dir"
            ? `Click para explorar carpeta en Gulin: ${info.target}`
            : `Click para abrir en el editor de Gulin: ${info.target}`;

    return (
        <span
            onClick={handleClick}
            title={tooltipTitle}
            className={cn(
                "inline-flex items-center gap-1.5 font-mono text-[12px] rounded-md px-2 py-0.5 border transition-all duration-150 select-text cursor-pointer group/path align-baseline my-0.5 shadow-sm",
                openedState
                    ? "bg-emerald-950/80 border-emerald-500/80 text-emerald-300"
                    : "bg-zinc-900/90 border-teal-500/40 hover:border-teal-400 text-teal-300 hover:text-teal-200 hover:bg-zinc-800/90 hover:shadow-teal-950/40 hover:shadow-md",
                className
            )}
        >
            <i className={cn("text-[11px] shrink-0 transition-transform group-hover/path:scale-110", openedState ? "fa-solid fa-check text-emerald-400" : info.icon)} />
            <span className="underline decoration-teal-500/30 group-hover/path:decoration-teal-300 break-all">{text}</span>
            <i className="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-60 group-hover/path:opacity-100 transition-opacity ml-0.5" />
        </span>
    );
}

function CodePlain({ className = "", isCodeBlock, text }: { className?: string; isCodeBlock: boolean; text: string }) {
    if (isCodeBlock) {
        return <code className={cn("font-mono text-[12px]", className)}>{text}</code>;
    }

    const linkInfo = getPathOrUrlInfo(text);

    if (linkInfo) {
        return <ClickablePathBadge text={text} info={linkInfo} className={className} />;
    }

    return (
        <code className={cn("text-green-400 font-mono text-[12px] rounded bg-zinc-800/90 px-1.5 py-0.5 border border-zinc-700/50", className)}>
            {text}
        </code>
    );
}

function CodeHighlight({ className = "", lang, text }: { className?: string; lang: string; text: string }) {
    const [html, setHtml] = useState<string>("");
    const [hasError, setHasError] = useState(false);
    const codeRef = useRef<HTMLElement>(null);
    const seqRef = useRef(0);

    const highlightCode = useCallback(
        async (textToHighlight: string, language: string, disposedRef: { current: boolean }, seq: number) => {
            try {
                const full = await codeToHtml(textToHighlight, { lang: language, theme: ShikiTheme });
                const start = full.indexOf("<code");
                const open = full.indexOf(">", start);
                const end = full.lastIndexOf("</code>");
                const inner = start !== -1 && open !== -1 && end !== -1 ? full.slice(open + 1, end) : "";
                if (!disposedRef.current && seq === seqRef.current) {
                    setHtml(inner);
                    setHasError(false);
                }
            } catch (e) {
                if (!disposedRef.current && seq === seqRef.current) {
                    setHasError(true);
                }
                console.warn(`Shiki highlight failed for ${language}`, e);
            }
        },
        []
    );

    const throttledHighlight = useMemo(() => throttle(300, highlightCode, { noLeading: false }), [highlightCode]);

    useEffect(() => {
        const disposedRef = { current: false };

        if (!text) {
            setHtml("");
            return;
        }

        seqRef.current++;
        const currentSeq = seqRef.current;
        throttledHighlight(text, lang, disposedRef, currentSeq);

        return () => {
            disposedRef.current = true;
        };
    }, [text, lang, throttledHighlight]);

    if (hasError) {
        return (
            <code ref={codeRef} className={cn("font-mono text-[12px]", className)}>
                {text}
            </code>
        );
    }

    if (!html && text) {
        return (
            <code ref={codeRef} className={cn("font-mono text-[12px] text-transparent", className)}>
                {text}
            </code>
        );
    }

    return (
        <code
            ref={codeRef}
            className={cn("font-mono text-[12px]", className)}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

export function Code({ className = "", children }: { className?: string; children: React.ReactNode }) {
    const m = className?.match(/language-([\w+-]+)/i);
    const isCodeBlock = !!m;
    const lang = m?.[1] || "text";
    const text = extractText(children);

    if (isCodeBlock && lang in bundledLanguages) {
        return <CodeHighlight className={className} lang={lang} text={text} />;
    }

    return <CodePlain className={className} isCodeBlock={isCodeBlock} text={text} />;
}

export function executeCommandInActiveTerminal(cmd: string): boolean {
    const cleanCmd = cmd.trim();
    if (!cleanCmd) return false;

    let targetBlockId = getFocusedBlockId();
    const allBlocks = getAllBlockComponentModels();

    if (!targetBlockId) {
        // Find first terminal block in the current workspace/tab
        const termBlock = allBlocks.find(b => {
            const vt = (b?.viewModel as any)?.viewType;
            return vt === "term" || vt === "terminal" || typeof (b?.viewModel as any)?.sendDataToController === "function";
        });
        if (termBlock) {
            targetBlockId = termBlock.blockId;
        }
    }

    if (targetBlockId) {
        refocusNode(targetBlockId);
        const bcm = getBlockComponentModel(targetBlockId);
        if (bcm?.viewModel && typeof (bcm.viewModel as any).sendDataToController === "function") {
            (bcm.viewModel as any).sendDataToController(cleanCmd + "\n");
            return true;
        }
        // Fallback to RPC
        const b64data = stringToBase64(cleanCmd + "\n");
        RpcApi.ControllerInputCommand(TabRpcClient, { blockid: targetBlockId, inputdata64: b64data });
        return true;
    }

    // Fallback: Copy to clipboard if no terminal block found
    navigator.clipboard.writeText(cleanCmd);
    return false;
}

type CodeBlockProps = {
    children: React.ReactNode;
    onClickExecute?: (cmd: string) => void;
    codeBlockMaxWidthAtom?: Atom<number>;
};

const CodeBlock = ({ children, onClickExecute, codeBlockMaxWidthAtom }: CodeBlockProps) => {
    const codeBlockMaxWidth = useAtomValueSafe(codeBlockMaxWidthAtom);
    const [isCopied, setIsCopied] = useState(false);
    const [executingState, setExecutingState] = useState<"idle" | "sent">("idle");

    const getLanguage = (children: any): string => {
        if (children?.props?.className) {
            const match = children.props.className.match(/language-([\w+-]+)/i);
            if (match) return match[1];
        }
        return "text";
    };

    const rawText = extractText(children).trim();
    const language = getLanguage(children).toLowerCase();

    const isTerminalExecutable = useMemo(() => {
        const execLangs = ["bash", "sh", "zsh", "shell", "cmd", "powershell", "ps1", "sql", "python", "py", "javascript", "js", "ts", "node"];
        return execLangs.includes(language);
    }, [language]);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const textToCopy = extractText(children).replace(/\n$/, "");
        await navigator.clipboard.writeText(textToCopy);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleExecute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const cmd = extractText(children).replace(/\n$/, "");
        if (onClickExecute) {
            onClickExecute(cmd);
        } else {
            executeCommandInActiveTerminal(cmd);
        }
        setExecutingState("sent");
        setTimeout(() => setExecutingState("idle"), 2500);
    };

    // INTERCEPT SPECIAL AIOPS FENCED BLOCKS
    if (language === "aiops-infra" || language === "infra-grid") {
        try {
            const parsed = JSON.parse(rawText);
            return <InfraGridWidget {...parsed} />;
        } catch (_) {}
    }

    if (language === "execution-plan" || language === "aiops-plan") {
        try {
            const parsed = JSON.parse(rawText);
            return <ExecutionPlanWidget {...parsed} />;
        } catch (_) {}
    }

    if (language === "sla-report" || language === "aiops-sla") {
        try {
            const parsed = JSON.parse(rawText);
            return <SlaReportWidget {...parsed} />;
        } catch (_) {}
    }

    if (language === "kpi-summary" || language === "kpi-grid") {
        try {
            const parsed = JSON.parse(rawText);
            return <KpiSummaryWidget {...parsed} />;
        } catch (_) {}
    }

    return (
        <div
            className={cn(
                "rounded-xl overflow-hidden bg-[#0d0e11] border border-zinc-800/80 my-3 shadow-2xl transition-all duration-200 group/code hover:border-zinc-700",
                codeBlockMaxWidth && "max-w-full"
            )}
            style={
                codeBlockMaxWidth
                    ? { maxWidth: codeBlockMaxWidth, minWidth: Math.min(400, codeBlockMaxWidth) }
                    : undefined
            }
        >
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-900/80 border-b border-zinc-800/60 select-none">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500/80" />
                    <span className="text-[10px] font-mono font-bold tracking-wider text-green-400/90 uppercase">
                        {language !== "text" ? language : "CODE"}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {/* Botón Ejecutar en Terminal */}
                    {isTerminalExecutable && (
                        <button
                            onClick={handleExecute}
                            className={cn(
                                "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer shadow-sm active:scale-95",
                                executingState === "sent"
                                    ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/50"
                                    : "bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 hover:border-green-400"
                            )}
                            title="Ejecutar directamente en la terminal activa"
                        >
                            <i className={cn("text-[10px]", executingState === "sent" ? "fa-solid fa-check text-emerald-400" : "fa-solid fa-play text-green-400")} />
                            <span>{executingState === "sent" ? "Enviado ✓" : "Run in Terminal"}</span>
                        </button>
                    )}

                    {/* Botón Copiar */}
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer"
                        title="Copiar código al portapapeles"
                    >
                        <i className={cn("text-[10px]", isCopied ? "fa-solid fa-check text-emerald-400" : "fa-regular fa-copy")} />
                        <span>{isCopied ? "Copiado" : "Copiar"}</span>
                    </button>
                </div>
            </div>
            <pre className="p-3.5 overflow-x-auto m-0 text-gray-100 max-w-full text-xs font-mono leading-relaxed custom-scrollbar">{children}</pre>
        </div>
    );
};

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="my-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
            <button
                className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-mono font-semibold text-zinc-300 hover:text-green-300 hover:bg-zinc-900/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-green-400 transition-transform duration-200">
                        {isOpen ? "▼" : "▶"}
                    </span>
                    <span>{title}</span>
                </div>
            </button>
            {isOpen && <div className="p-3 border-t border-zinc-800/80 text-secondary text-xs">{children}</div>}
        </div>
    );
}

// Auto-detector for table cells to render badges or money/numbers nicely
function SmartTableCell({ children }: { children: React.ReactNode }) {
    const text = extractText(children).trim();

    // Detección de badges automáticos
    const lower = text.toLowerCase();
    if (
        lower === "running" ||
        lower === "saturado" ||
        lower === "revisar" ||
        lower === "alto" ||
        lower === "falla" ||
        lower === "1 falla" ||
        lower === "ok" ||
        lower === "error=0" ||
        lower.includes("table access full") ||
        lower === "inactivo" ||
        lower === "bloqueado" ||
        lower === "0 incidentes" ||
        lower === "1 incidente"
    ) {
        return <StatusBadge status={text} />;
    }

    // Detección de dinero / dólares
    if (text.startsWith("$") || text.includes("USD")) {
        return <span className="font-mono font-bold text-amber-300">{children}</span>;
    }

    // Detección de porcentajes altos (ej. 99.98%, 87%)
    if (text.endsWith("%")) {
        return <span className="font-mono font-semibold text-zinc-200">{children}</span>;
    }

    return <>{children}</>;
}

interface GulinStreamdownProps {
    text: string;
    parseIncompleteMarkdown?: boolean;
    className?: string;
    onClickExecute?: (cmd: string) => void;
    codeBlockMaxWidthAtom?: Atom<number>;
}

export const GulinStreamdown = ({
    text,
    parseIncompleteMarkdown,
    className,
    onClickExecute,
    codeBlockMaxWidthAtom,
}: GulinStreamdownProps) => {
    const components = useMemo(
        () => ({
            code: Code,
            pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
                <CodeBlock
                    children={props.children}
                    onClickExecute={onClickExecute}
                    codeBlockMaxWidthAtom={codeBlockMaxWidthAtom}
                />
            ),
            p: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props} className="text-zinc-200 text-sm leading-relaxed" />,
            h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
                <h1 {...props} className="text-xl font-bold font-mono text-zinc-100 mt-5 mb-2.5 pb-1 border-b border-zinc-800 flex items-center gap-2" />
            ),
            h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
                <h2 {...props} className="text-lg font-bold font-mono text-green-400 mt-4 mb-2 flex items-center gap-2" />
            ),
            h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
                <h3 {...props} className="text-sm font-semibold font-mono text-zinc-200 mt-3 mb-1.5" />
            ),
            h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
                <h4 {...props} className="text-xs font-semibold font-mono text-zinc-300 mt-2 mb-1" />
            ),
            h5: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
                <h5 {...props} className="text-xs font-semibold text-zinc-400 mt-2 mb-1" />
            ),
            h6: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
                <h6 {...props} className="text-xs text-zinc-400 mt-2 mb-1" />
            ),
            // Glassmorphism Dark Table Container
            table: (props: React.HTMLAttributes<HTMLTableElement>) => (
                <div className="w-full my-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 overflow-hidden shadow-2xl backdrop-blur-md">
                    <div className="overflow-x-auto">
                        <table {...props} className="w-full text-left font-mono text-xs border-collapse" />
                    </div>
                </div>
            ),
            thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
                <thead {...props} className="bg-zinc-900/80 border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider" />
            ),
            tbody: (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} className="divide-y divide-zinc-800/40" />,
            tr: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
                <tr {...props} className="hover:bg-zinc-800/30 transition-colors" />
            ),
            th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
                <th {...props} className="py-2.5 px-3 font-semibold text-zinc-300" />
            ),
            td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
                <td {...props} className="py-2 px-3 text-zinc-300 align-middle">
                    <SmartTableCell>{props.children}</SmartTableCell>
                </td>
            ),
            ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
                <ul
                    {...props}
                    className="list-disc list-outside pl-5 mt-1 mb-2 text-zinc-200 text-xs space-y-1 [&_ul]:my-1 [&_ol]:my-1"
                />
            ),
            ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
                <ol
                    {...props}
                    className="list-decimal list-outside pl-5 mt-1 mb-2 text-zinc-200 text-xs space-y-1 [&_ul]:my-1 [&_ol]:my-1"
                />
            ),
            li: (props: React.HTMLAttributes<HTMLLIElement>) => (
                <li {...props} className="text-zinc-300 leading-relaxed" />
            ),
            // Modern Callout / Alert Cards for Blockquotes
            blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => {
                const text = extractText(props.children);
                let borderColor = "border-green-500/50";
                let bgColor = "bg-green-950/20";
                let textColor = "text-green-200";
                let icon = "fa-circle-info";

                if (text.includes("[!WARNING]") || text.includes("⚠️") || text.includes("Alerta") || text.includes("Hipótesis")) {
                    borderColor = "border-amber-500/50";
                    bgColor = "bg-amber-950/20";
                    textColor = "text-amber-200";
                    icon = "fa-triangle-exclamation";
                } else if (text.includes("[!CAUTION]") || text.includes("[!DANGER]") || text.includes("🔴") || text.includes("Crítico")) {
                    borderColor = "border-red-500/50";
                    bgColor = "bg-red-950/20";
                    textColor = "text-red-200";
                    icon = "fa-circle-exclamation";
                } else if (text.includes("[!TIP]") || text.includes("💡") || text.includes("Recomendación")) {
                    borderColor = "border-emerald-500/50";
                    bgColor = "bg-emerald-950/20";
                    textColor = "text-emerald-200";
                    icon = "fa-lightbulb";
                }

                return (
                    <div className={cn("my-3 p-3.5 rounded-xl border-l-4 border shadow-lg flex items-start gap-3 backdrop-blur-md", borderColor, bgColor)}>
                        <i className={cn("fa-solid mt-0.5 text-sm shrink-0", icon, textColor)} />
                        <div className={cn("text-xs leading-relaxed font-sans", textColor)}>{props.children}</div>
                    </div>
                );
            },
            details: ({ children, ...props }: any) => {
                const childArray = Array.isArray(children) ? children : [children];
                const summary = childArray.find((c) => c?.props?.node?.tagName === "summary");
                const summaryText = summary?.props?.children || "Detalles del Análisis";
                const content = childArray.filter((c) => c?.props?.node?.tagName !== "summary");

                return (
                    <Collapsible title={summaryText} defaultOpen={props.open}>
                        {content}
                    </Collapsible>
                );
            },
            summary: () => null,
            a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
                const href = props.href || "";
                const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!href) return;
                    if (href.startsWith("http://") || href.startsWith("https://")) {
                        openLink(href);
                    } else if (href.startsWith("file://")) {
                        const clean = decodeURIComponent(href.replace(/^file:\/\//, ""));
                        openPathInGulin(clean);
                    } else if (href.startsWith("/") || href.startsWith("~") || /^[a-zA-Z]:[/\\]/.test(href)) {
                        openPathInGulin(href);
                    } else {
                        openLink(href);
                    }
                };

                return (
                    <a
                        {...props}
                        onClick={handleClick}
                        className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 font-mono underline decoration-teal-500/40 hover:decoration-teal-300 transition-colors cursor-pointer"
                        title={props.title || `Abrir en Gulin: ${href}`}
                    >
                        {props.children}
                        <i className="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-70" />
                    </a>
                );
            },
            strong: (props: React.HTMLAttributes<HTMLElement>) => (
                <strong {...props} className="font-bold text-zinc-100" />
            ),
            em: (props: React.HTMLAttributes<HTMLElement>) => <em {...props} className="italic text-zinc-300" />,
        }),
        [onClickExecute, codeBlockMaxWidthAtom]
    );

    return (
        <Streamdown
            parseIncompleteMarkdown={parseIncompleteMarkdown}
            className={cn(
                "gulin-streamdown text-gray-100 [&>*:first-child]:mt-0 [&>*:first-child>*:first-child]:mt-0 space-y-2",
                className
            )}
            shikiTheme={[ShikiTheme, ShikiTheme]}
            controls={{
                code: false,
                table: false,
                mermaid: true,
            }}
            components={components}
        >
            {text}
        </Streamdown>
    );
};
