// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// ============================================================================
// W3C WebMCP (Web Model Context Protocol) Runtime Implementation
// Standard specification: https://github.com/webmachinelearning/webmcp
// Exposes `document.modelContext` to enable AI agent tool invocation client-side.
// ============================================================================

export interface WebMCPToolDefinition {
    name: string;
    description: string;
    inputSchema?: Record<string, any>;
    execute: (params: any, options?: { signal?: AbortSignal }) => Promise<any> | any;
}

export interface RegisteredTool {
    name: string;
    description: string;
    inputSchema?: Record<string, any>;
    origin: string;
    declarative?: boolean;
}

export interface RegisterToolOptions {
    signal?: AbortSignal;
    exposedTo?: string[];
}

export interface GetToolOptions {
    fromOrigins?: string[];
}

export interface ExecuteToolOptions {
    signal?: AbortSignal;
}

export class ModelContext extends EventTarget {
    private tools = new Map<string, { def: WebMCPToolDefinition; registered: RegisteredTool; options?: RegisterToolOptions }>();
    private onToolsChangedCallback?: (tools: RegisteredTool[]) => void;
    private origin: string;

    constructor(origin: string, onToolsChanged?: (tools: RegisteredTool[]) => void) {
        super();
        this.origin = origin || (typeof window !== "undefined" ? window.location.origin : "https://localhost");
        this.onToolsChangedCallback = onToolsChanged;
    }

    /**
     * Registers an imperative tool into the model context.
     * Tools can be unregistered by aborting the optional AbortSignal.
     */
    async registerTool(def: WebMCPToolDefinition, options?: RegisterToolOptions): Promise<RegisteredTool> {
        if (!def || !def.name) {
            throw new Error("WebMCP: Tool definition must have a valid 'name'");
        }
        if (typeof def.execute !== "function") {
            throw new Error(`WebMCP: Tool '${def.name}' must have an 'execute' function`);
        }

        const registered: RegisteredTool = {
            name: def.name,
            description: def.description || "",
            inputSchema: def.inputSchema || { type: "object", properties: {} },
            origin: this.origin,
            declarative: false,
        };

        this.tools.set(def.name, { def, registered, options });

        // Handle abort signal for dynamic unregistration
        if (options?.signal) {
            if (options.signal.aborted) {
                this.tools.delete(def.name);
                return registered;
            }
            options.signal.addEventListener("abort", () => {
                this.unregisterTool(def.name);
            }, { once: true });
        }

        this.notifyChange();
        return registered;
    }

    /**
     * Unregisters a tool by name.
     */
    unregisterTool(name: string): boolean {
        if (this.tools.has(name)) {
            this.tools.delete(name);
            this.notifyChange();
            return true;
        }
        return false;
    }

    /**
     * Returns all registered tools matching the origins.
     */
    async getTools(options?: GetToolOptions): Promise<RegisteredTool[]> {
        const result: RegisteredTool[] = [];
        for (const entry of this.tools.values()) {
            result.push({ ...entry.registered });
        }
        return result;
    }

    /**
     * Executes a registered tool by tool definition or name with the provided parameters.
     */
    async executeTool(toolOrName: string | RegisteredTool, params?: any, options?: ExecuteToolOptions): Promise<any> {
        const toolName = typeof toolOrName === "string" ? toolOrName : toolOrName?.name;
        if (!toolName) {
            throw new Error("WebMCP: Missing tool name");
        }

        const entry = this.tools.get(toolName);
        if (!entry) {
            throw new Error(`WebMCP: Tool '${toolName}' is not registered`);
        }

        // Check cancellation
        if (options?.signal?.aborted) {
            throw new Error("WebMCP: Execution aborted by caller");
        }

        try {
            const output = await entry.def.execute(params || {}, { signal: options?.signal });
            return output;
        } catch (error: any) {
            throw new Error(`WebMCP: Tool execution failed for '${toolName}': ${error?.message || error}`);
        }
    }

    /**
     * Scans declarative HTML forms matching data-tool-name and registers them.
     */
    scanDeclarativeForms(root: Document | HTMLElement = document) {
        if (!root || !root.querySelectorAll) return;
        const forms = root.querySelectorAll<HTMLFormElement>("form[data-tool-name]");
        forms.forEach((form) => {
            const name = form.getAttribute("data-tool-name");
            if (!name) return;
            const description = form.getAttribute("data-tool-description") || `Form tool for ${name}`;
            
            // Build properties from form inputs
            const properties: Record<string, any> = {};
            const required: string[] = [];
            const inputs = form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
            
            inputs.forEach((input) => {
                const inputName = input.name || input.id;
                if (!inputName) return;
                const placeholder = "placeholder" in input ? (input as HTMLInputElement).placeholder : "";
                properties[inputName] = {
                    type: (input as HTMLInputElement).type === "number" ? "number" : "string",
                    description: placeholder || input.getAttribute("aria-label") || inputName,
                };
                if (input.required) {
                    required.push(inputName);
                }
            });

            this.registerTool({
                name,
                description,
                inputSchema: {
                    type: "object",
                    properties,
                    required,
                },
                execute: async (params: any) => {
                    // Fill inputs and submit
                    Object.entries(params || {}).forEach(([key, val]) => {
                        const el = form.elements.namedItem(key) as HTMLInputElement;
                        if (el) {
                            el.value = String(val);
                            el.dispatchEvent(new Event("input", { bubbles: true }));
                            el.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                    });
                    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                    return { success: true, message: `Form '${name}' submitted` };
                },
            });
        });
    }

    private notifyChange() {
        this.dispatchEvent(new Event("toolchange"));
        if (this.onToolsChangedCallback) {
            const list: RegisteredTool[] = [];
            for (const item of this.tools.values()) {
                list.push({ ...item.registered });
            }
            this.onToolsChangedCallback(list);
        }
    }
}

export const WEBMCP_MAIN_WORLD_SCRIPT = `(function() {
    if (window.__gulinWebMcpInstalled && document.modelContext) return;
    window.__gulinWebMcpInstalled = true;

    class ModelContext extends EventTarget {
        constructor(origin) {
            super();
            this.origin = origin || (typeof window !== "undefined" ? window.location.origin : "https://localhost");
            this.tools = new Map();
        }

        async registerTool(def, options) {
            if (!def || !def.name) throw new Error("WebMCP: Tool definition must have a valid 'name'");
            if (typeof def.execute !== "function") throw new Error("WebMCP: Tool must have an 'execute' function");

            const registered = {
                name: def.name,
                description: def.description || "",
                inputSchema: def.inputSchema || { type: "object", properties: {} },
                origin: this.origin,
                declarative: def.declarative || false,
            };

            this.tools.set(def.name, { def, registered, options });

            if (options && options.signal) {
                options.signal.addEventListener("abort", () => {
                    this.unregisterTool(def.name);
                }, { once: true });
            }

            this.dispatchEvent(new Event("toolchange"));
            window.dispatchEvent(new CustomEvent("webmcp-tools-updated", { detail: { tools: this.getToolsSync() } }));
            return registered;
        }

        unregisterTool(name) {
            if (this.tools.has(name)) {
                this.tools.delete(name);
                this.dispatchEvent(new Event("toolchange"));
                window.dispatchEvent(new CustomEvent("webmcp-tools-updated", { detail: { tools: this.getToolsSync() } }));
                return true;
            }
            return false;
        }

        getToolsSync() {
            const list = [];
            for (const item of this.tools.values()) {
                list.push({ ...item.registered });
            }
            return list;
        }

        async getTools() {
            return this.getToolsSync();
        }

        async executeTool(name, params) {
            const entry = this.tools.get(name);
            if (!entry) throw new Error("WebMCP: Tool '" + name + "' not found");
            return await entry.def.execute(params || {});
        }

        scanDeclarativeForms(rootDoc) {
            const doc = rootDoc || document;
            const forms = doc.querySelectorAll("form[data-tool-name]");
            forms.forEach((form) => {
                const name = form.getAttribute("data-tool-name");
                if (!name || this.tools.has(name)) return;
                const desc = form.getAttribute("data-tool-desc") || "Formulario HTML declarativo";
                this.registerTool({
                    name,
                    description: desc,
                    declarative: true,
                    execute: async (p) => {
                        Object.entries(p || {}).forEach(([k, v]) => {
                            const el = form.elements.namedItem(k);
                            if (el) { el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); }
                        });
                        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                        return { success: true };
                    }
                });
            });
        }
    }

    const mc = new ModelContext(window.location.origin);
    try {
        Object.defineProperty(document, "modelContext", { value: mc, writable: true, configurable: true });
    } catch (_) {
        document.modelContext = mc;
    }
    window.modelContext = mc;
    window.__ensureWebMCP = () => {};

    // Auto-register Site Adapters
    const url = window.location.href;

    // Wikipedia
    if (url.includes("wikipedia.org")) {
        mc.registerTool({
            name: "wikipedia_get_summary",
            description: "Extrae el resumen principal, título y secciones clave del artículo actual de Wikipedia.",
            inputSchema: { type: "object", properties: {} },
            execute: async () => {
                const title = document.getElementById("firstHeading")?.textContent?.trim() || document.title;
                const paragraphs = document.querySelectorAll(".mw-parser-output > p");
                let summary = "";
                for (let i = 0; i < paragraphs.length; i++) {
                    const t = (paragraphs[i].textContent || "").trim();
                    if (t.length > 50) { summary = t; break; }
                }
                const headings = Array.from(document.querySelectorAll(".mw-parser-output h2, .mw-parser-output h3"))
                    .map(h => h.textContent?.replace(/\\[editar\\]/g, "").trim())
                    .filter(Boolean)
                    .slice(0, 15);
                return { title, summary, sections: headings };
            }
        });
    }

    // Mercado Libre
    if (url.includes("mercadolibre.")) {
        mc.registerTool({
            name: "mercadolibre_get_page_items",
            description: "Extrae de forma limpia y estructurada la lista de productos visibles en la página de Mercado Libre (título, precio en CLP, enlace, envío gratis).",
            inputSchema: {
                type: "object",
                properties: {
                    limit: { type: "number", description: "Cantidad máxima de productos a retornar (por defecto 10)" }
                }
            },
            execute: async (p) => {
                const limit = (p && p.limit) || 10;
                const items = [];
                const cards = document.querySelectorAll(".ui-search-layout__item, .poly-card, .ui-search-result");
                cards.forEach((card, idx) => {
                    if (idx >= limit) return;
                    const titleEl = card.querySelector(".ui-search-item__title, .poly-component__title, h2, a.ui-search-link");
                    const priceFraction = card.querySelector(".andes-money-amount__fraction, .poly-price__current .andes-money-amount__fraction");
                    const linkEl = card.querySelector("a.ui-search-link, a.poly-component__title");
                    const freeShipEl = card.querySelector(".poly-shipping, .ui-search-item__shipping--free");
                    const title = titleEl ? (titleEl.textContent || "").trim() : "";
                    const priceText = priceFraction ? (priceFraction.textContent || "").trim().replace(/\\./g, "") : "0";
                    const priceNum = parseInt(priceText, 10) || 0;
                    if (title) {
                        items.push({
                            title,
                            price: "$" + priceText.replace(/\\B(?=(\\d{3})+(?!\\d))/g, "."),
                            rawPrice: priceNum,
                            url: linkEl ? linkEl.href : "",
                            freeShipping: !!freeShipEl,
                        });
                    }
                });
                return { totalFound: items.length, products: items };
            }
        });

        mc.registerTool({
            name: "mercadolibre_search",
            description: "Realiza una búsqueda de productos en Mercado Libre con filtros y ordenamiento.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Término a buscar (ej: 'arenero de gatos')" },
                    sort: { type: "string", description: "Orden: 'price_asc' (más barato), 'price_desc' (más caro), o 'relevance'", enum: ["price_asc", "price_desc", "relevance"] }
                },
                required: ["query"]
            },
            execute: async (p) => {
                if (!p || !p.query) throw new Error("El parámetro 'query' es requerido");
                const q = encodeURIComponent(p.query);
                let sortSuffix = "";
                if (p.sort === "price_asc") sortSuffix = "_PriceOrder_Asc";
                else if (p.sort === "price_desc") sortSuffix = "_PriceOrder_Desc";
                const targetUrl = window.location.origin + "/" + q + sortSuffix;
                window.location.href = targetUrl;
                return { status: "navigating", targetUrl };
            }
        });
    }

    // Google Search
    if (url.includes("google.") && url.includes("/search")) {
        mc.registerTool({
            name: "google_get_results",
            description: "Obtiene títulos, descripciones y URLs de los resultados orgánicos de Google.",
            inputSchema: { type: "object", properties: { limit: { type: "number" } } },
            execute: async (p) => {
                const limit = (p && p.limit) || 8;
                const results = [];
                const searchBlocks = document.querySelectorAll("#search .g, .MjjYud");
                searchBlocks.forEach((block, idx) => {
                    if (idx >= limit) return;
                    const h3 = block.querySelector("h3");
                    const a = block.querySelector("a");
                    const snippet = block.querySelector(".VwiC3b, .yXK7lf, [data-sncf]");
                    if (h3 && a && a.href && !a.href.includes("google.com/search")) {
                        results.push({ title: (h3.textContent || "").trim(), snippet: snippet ? (snippet.textContent || "").trim() : "", url: a.href });
                    }
                });
                return { total: results.length, results };
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => mc.scanDeclarativeForms());
    } else {
        mc.scanDeclarativeForms();
    }
})();`;

/**
 * Initializes and binds \`document.modelContext\` conforming to W3C WebMCP.
 */
export function setupWebMCP(doc: any, onToolsChanged?: (tools: RegisteredTool[]) => void): ModelContext {
    if (!doc) return null as any;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://localhost";
    const modelContext = new ModelContext(origin, onToolsChanged);

    try {
        Object.defineProperty(doc, "modelContext", {
            value: modelContext,
            writable: true,
            configurable: true,
        });
    } catch (_) {
        doc.modelContext = modelContext;
    }

    // Auto-scan declarative forms when DOM is ready
    if (typeof window !== "undefined") {
        if (doc.readyState === "loading") {
            doc.addEventListener("DOMContentLoaded", () => {
                modelContext.scanDeclarativeForms(doc);
            });
        } else {
            modelContext.scanDeclarativeForms(doc);
        }
    }

    return modelContext;
}
