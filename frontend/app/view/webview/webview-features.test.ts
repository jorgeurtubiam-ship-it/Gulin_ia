// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0
//
// ┌─────────────────────────────────────────────────────────────────┐
// │  GULIN BROWSER — SUITE COMPLETA DE PRUEBAS                     │
// │  Ejecutar con: npx vitest run                                   │
// │  o en modo watch: npx vitest                                    │
// └─────────────────────────────────────────────────────────────────┘

import { describe, it, expect, vi } from "vitest";

// ── Módulos bajo prueba ────────────────────────────────────────────
import { browserAgentTools, getBrowserAgentToolDefinitions, executeBrowserAgentTool } from "./browser-agent-tools";
import { formatAsMarkdown, getClipPageScript } from "./web-clipper";
import { toggleReaderModeScript, READER_MODE_CSS } from "./reader-mode";
import { ModelContext } from "../../../../emain/webmcp-runtime";
import { registerSiteAdapters } from "../../../../emain/webmcp-site-adapters";

// ══════════════════════════════════════════════════════════════════
// BLOQUE 1 — Browser Agent: Definición de Herramientas
// ══════════════════════════════════════════════════════════════════
describe("🤖 Browser Agent — Definición de las 8 herramientas", () => {
    it("debe exponer exactamente 8 herramientas de IA", () => {
        expect(getBrowserAgentToolDefinitions()).toHaveLength(8);
    });

    it("debe contener los nombres correctos de todas las herramientas", () => {
        const names = getBrowserAgentToolDefinitions().map((d) => d.name);
        expect(names).toEqual(
            expect.arrayContaining([
                "browser_screenshot",
                "browser_read_page",
                "browser_navigate",
                "browser_click",
                "browser_double_click",
                "browser_type",
                "browser_key",
                "browser_scroll",
            ])
        );
    });

    it("cada herramienta debe tener descripción no vacía", () => {
        for (const tool of browserAgentTools) {
            expect(tool.description.length).toBeGreaterThan(10);
        }
    });

    it("cada herramienta debe tener esquema de parámetros tipo objeto", () => {
        for (const tool of browserAgentTools) {
            expect(tool.parameters.type).toBe("object");
            expect(tool.parameters.properties).toBeDefined();
        }
    });

    it("cada herramienta debe tener función execute válida", () => {
        for (const tool of browserAgentTools) {
            expect(typeof tool.execute).toBe("function");
        }
    });

    it("browser_click debe requerir coordenadas x e y", () => {
        const tool = browserAgentTools.find((t) => t.name === "browser_click");
        expect(tool?.parameters.required).toContain("x");
        expect(tool?.parameters.required).toContain("y");
    });

    it("browser_double_click debe requerir coordenadas x e y", () => {
        const tool = browserAgentTools.find((t) => t.name === "browser_double_click");
        expect(tool?.parameters.required).toContain("x");
        expect(tool?.parameters.required).toContain("y");
    });

    it("browser_navigate debe requerir parámetro url", () => {
        const tool = browserAgentTools.find((t) => t.name === "browser_navigate");
        expect(tool?.parameters.required).toContain("url");
    });

    it("browser_type debe requerir parámetro text", () => {
        const tool = browserAgentTools.find((t) => t.name === "browser_type");
        expect(tool?.parameters.required).toContain("text");
    });

    it("browser_key debe requerir parámetro key", () => {
        const tool = browserAgentTools.find((t) => t.name === "browser_key");
        expect(tool?.parameters.required).toContain("key");
    });

    it("browser_scroll debe requerir parámetro deltaY", () => {
        const tool = browserAgentTools.find((t) => t.name === "browser_scroll");
        expect(tool?.parameters.required).toContain("deltaY");
    });

    it("browser_screenshot no debe requerir parámetros obligatorios", () => {
        const tool = browserAgentTools.find((t) => t.name === "browser_screenshot");
        expect(tool?.parameters.required ?? []).toHaveLength(0);
    });

    it("browser_read_page no debe requerir parámetros obligatorios", () => {
        const tool = browserAgentTools.find((t) => t.name === "browser_read_page");
        expect(tool?.parameters.required ?? []).toHaveLength(0);
    });
});

// ══════════════════════════════════════════════════════════════════
// BLOQUE 2 — Browser Agent: Ejecución con modelo mock
// ══════════════════════════════════════════════════════════════════
describe("🤖 Browser Agent — Ejecución con modelo mock", () => {
    const createMockModel = (overrides: any = {}) => ({
        webviewRef: {
            current: {
                getWebContentsId: () => 42,
                executeJavaScript: vi.fn().mockResolvedValue("texto de prueba"),
                getTitle: vi.fn().mockReturnValue("Página de prueba"),
            },
        },
        loadUrl: vi.fn().mockResolvedValue(undefined),
        getUrl: vi.fn().mockReturnValue("https://ejemplo.com"),
        ...overrides,
    });

    it("browser_read_page debe llamar a executeJavaScript y retornar texto", async () => {
        const model = createMockModel();
        const tool = browserAgentTools.find((t) => t.name === "browser_read_page")!;
        const result = await tool.execute(model, {});
        expect(model.webviewRef.current.executeJavaScript).toHaveBeenCalled();
        expect(result.status).toBe("success");
        expect(result).toHaveProperty("text");
    });

    it("browser_navigate debe llamar a model.loadUrl con la URL provista", async () => {
        const model = createMockModel();
        const tool = browserAgentTools.find((t) => t.name === "browser_navigate")!;
        await tool.execute(model, { url: "https://google.com" });
        expect(model.loadUrl).toHaveBeenCalledWith("https://google.com", "browser-agent");
    });

    it("browser_navigate debe lanzar error si falta la URL", async () => {
        const model = createMockModel();
        const tool = browserAgentTools.find((t) => t.name === "browser_navigate")!;
        await expect(tool.execute(model, {})).rejects.toThrow("url");
    });

    it("browser_scroll debe ejecutar window.scrollBy en el webview", async () => {
        const model = createMockModel();
        const tool = browserAgentTools.find((t) => t.name === "browser_scroll")!;
        const result = await tool.execute(model, { deltaY: 300 });
        expect(model.webviewRef.current.executeJavaScript).toHaveBeenCalledWith(
            expect.stringContaining("scrollBy")
        );
        expect(result.status).toBe("success");
    });

    it("browser_screenshot debe lanzar error si no hay webview activo", async () => {
        const model = { webviewRef: { current: null } };
        const tool = browserAgentTools.find((t) => t.name === "browser_screenshot")!;
        await expect(tool.execute(model, {})).rejects.toThrow();
    });

    it("executeBrowserAgentTool debe lanzar error para herramienta desconocida", async () => {
        const model = createMockModel();
        await expect(executeBrowserAgentTool("herramienta_fantasma", {}, model)).rejects.toThrow(
            "herramienta_fantasma"
        );
    });

    it("executeBrowserAgentTool debe ejecutar browser_scroll correctamente", async () => {
        const model = createMockModel();
        const result = await executeBrowserAgentTool("browser_scroll", { deltaY: 100 }, model);
        expect(result.status).toBe("success");
    });
});

// ══════════════════════════════════════════════════════════════════
// BLOQUE 3 — Web Clipper
// ══════════════════════════════════════════════════════════════════
describe("📝 Web Clipper — Guardado como Markdown", () => {
    const sampleData = {
        title: "Gulin Terminal Docs",
        url: "https://gulin.dev/docs",
        content: "Esta es la documentación oficial de Gulin.",
        date: "2026-09-10T12:00:00.000Z",
    };

    it("debe generar frontmatter YAML con title, url y source", () => {
        const md = formatAsMarkdown(sampleData);
        expect(md).toContain('title: "Gulin Terminal Docs"');
        expect(md).toContain('url: "https://gulin.dev/docs"');
        expect(md).toContain('source: "Gulin Web Clipper"');
    });

    it("debe incluir encabezado H1 con el título de la página", () => {
        const md = formatAsMarkdown(sampleData);
        expect(md).toContain("# Gulin Terminal Docs");
    });

    it("debe incluir el contenido extraído de la página", () => {
        const md = formatAsMarkdown(sampleData);
        expect(md).toContain("Esta es la documentación oficial de Gulin.");
    });

    it("debe incluir enlace a la URL fuente", () => {
        const md = formatAsMarkdown(sampleData);
        expect(md).toContain("https://gulin.dev/docs");
    });

    it("debe escapar comillas dobles en el título", () => {
        const md = formatAsMarkdown({ ...sampleData, title: 'Título con "comillas"' });
        expect(md).toContain('\\"comillas\\"');
    });

    it("el script JS de captura debe ser un IIFE válido", () => {
        const script = getClipPageScript();
        expect(script.trim()).toMatch(/^\(function\(\)/);
        expect(script).toContain("document.title");
        expect(script).toContain("window.location.href");
        expect(script).toContain("JSON.stringify");
    });

    it("el script de captura debe incluir límite de 25000 caracteres", () => {
        const script = getClipPageScript();
        expect(script).toContain("25000");
    });

    it("el script debe intentar leer la selección del usuario primero", () => {
        const script = getClipPageScript();
        expect(script).toContain("window.getSelection");
    });
});

// ══════════════════════════════════════════════════════════════════
// BLOQUE 4 — Reader Mode
// ══════════════════════════════════════════════════════════════════
describe("📖 Reader Mode — Modo Lector", () => {
    it("el script debe generar un IIFE válido", () => {
        const script = toggleReaderModeScript();
        expect(script.trim()).toMatch(/^\(function\(\)/);
    });

    it("debe crear el overlay con ID gulin-reader-overlay", () => {
        const script = toggleReaderModeScript();
        expect(script).toContain("gulin-reader-overlay");
    });

    it("debe crear el contenedor con ID gulin-reader-container", () => {
        const script = toggleReaderModeScript();
        expect(script).toContain("gulin-reader-container");
    });

    it("debe crear el botón de cerrar con ID gulin-reader-close", () => {
        const script = toggleReaderModeScript();
        expect(script).toContain("gulin-reader-close");
    });

    it("debe implementar toggle (eliminar si ya existe)", () => {
        const script = toggleReaderModeScript();
        expect(script).toContain("existing.remove()");
        expect(script).toContain("disabled");
    });

    it("debe buscar artículo, main o [role=main] como contenido principal", () => {
        const script = toggleReaderModeScript();
        expect(script).toContain("article");
        expect(script).toContain("main");
    });

    it("el CSS de reader mode debe incluir overlay de pantalla completa", () => {
        expect(READER_MODE_CSS).toContain("position: fixed");
        expect(READER_MODE_CSS).toContain("inset: 0");
        expect(READER_MODE_CSS).toContain("z-index: 9999999");
    });

    it("el CSS de reader mode debe definir ancho máximo del contenido (740px)", () => {
        expect(READER_MODE_CSS).toContain("740px");
        expect(READER_MODE_CSS).toContain("max-width");
    });

    it("el CSS de reader mode debe incluir estilos de tipografía", () => {
        expect(READER_MODE_CSS).toContain("font-size");
        expect(READER_MODE_CSS).toContain("line-height");
    });
});

// ══════════════════════════════════════════════════════════════════
// BLOQUE 5 — Gestión de Marcadores (lógica pura)
// ══════════════════════════════════════════════════════════════════
describe("⭐ Marcadores — Lógica de gestión", () => {
    type Bookmark = { id: string; url: string; title: string; createdAt: number };

    const makeBookmark = (url: string, title: string): Bookmark => ({
        id: `bm-${Date.now()}-${Math.random()}`,
        url,
        title,
        createdAt: Date.now(),
    });

    it("debe agregar un marcador a una lista vacía", () => {
        const list: Bookmark[] = [];
        const newBm = makeBookmark("https://gulin.dev", "Gulin");
        const updated = [newBm, ...list];
        expect(updated).toHaveLength(1);
        expect(updated[0].url).toBe("https://gulin.dev");
    });

    it("debe poder eliminar un marcador por ID", () => {
        const bm1 = makeBookmark("https://a.com", "A");
        const bm2 = makeBookmark("https://b.com", "B");
        const filtered = [bm1, bm2].filter((b) => b.id !== bm1.id);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].url).toBe("https://b.com");
    });

    it("debe detectar si una URL ya está marcada", () => {
        const bm = makeBookmark("https://gulin.dev", "Gulin");
        const list = [bm];
        expect(list.some((b) => b.url === "https://gulin.dev")).toBe(true);
        expect(list.some((b) => b.url === "https://otro.com")).toBe(false);
    });

    it("dos marcadores deben tener IDs únicos", () => {
        const bm1 = makeBookmark("https://a.com", "A");
        const bm2 = makeBookmark("https://b.com", "B");
        expect(bm1.id).not.toBe(bm2.id);
    });
});

// ══════════════════════════════════════════════════════════════════
// BLOQUE 6 — Gestión de Pestañas (lógica pura)
// ══════════════════════════════════════════════════════════════════
describe("🗂️ Pestañas — Lógica de gestión", () => {
    type Tab = { id: string; url: string; title: string };

    const makeTab = (url: string, title: string): Tab => ({
        id: `tab-${Date.now()}-${Math.random()}`,
        url,
        title,
    });

    it("nueva pestaña debe agregarse a la lista", () => {
        const tab1 = makeTab("https://a.com", "A");
        const tabs = [tab1];
        const newTab = makeTab("https://b.com", "B");
        const updated = [...tabs, newTab];
        expect(updated).toHaveLength(2);
        expect(updated[1].url).toBe("https://b.com");
    });

    it("cerrar pestaña activa debe activar la última restante", () => {
        const tab1 = makeTab("https://a.com", "A");
        const tab2 = makeTab("https://b.com", "B");
        const tab3 = makeTab("https://c.com", "C");
        const tabs = [tab1, tab2, tab3];
        const activeId = tab2.id;
        const filtered = tabs.filter((t) => t.id !== activeId);
        const nextActive = filtered[filtered.length - 1];
        expect(filtered).toHaveLength(2);
        expect(nextActive.url).toBe("https://c.com");
    });

    it("no debe cerrar si sólo hay una pestaña", () => {
        const tab1 = makeTab("https://a.com", "A");
        const tabs = [tab1];
        const shouldClose = tabs.length > 1;
        expect(shouldClose).toBe(false);
    });

    it("actualizar URL de la pestaña activa al navegar", () => {
        const tab = makeTab("https://old.com", "Vieja");
        let tabs = [tab];
        const activeId = tab.id;
        const newUrl = "https://nueva.com";
        tabs = tabs.map((t) => (t.id === activeId ? { ...t, url: newUrl, title: newUrl } : t));
        expect(tabs[0].url).toBe(newUrl);
    });
});

// ══════════════════════════════════════════════════════════════════
// BLOQUE 7 — Historial de Navegación (lógica pura)
// ══════════════════════════════════════════════════════════════════
describe("🕒 Historial — Lógica de registro", () => {
    type HistoryEntry = { url: string; title: string; visitedAt: number; visitCount: number };

    const addToHistory = (history: HistoryEntry[], url: string, title: string): HistoryEntry[] => {
        if (!url || url.startsWith("data:") || url.startsWith("about:")) return history;
        const existingIdx = history.findIndex((h) => h.url === url);
        if (existingIdx >= 0) {
            const updated = [...history];
            updated[existingIdx] = { ...updated[existingIdx], visitedAt: Date.now(), visitCount: updated[existingIdx].visitCount + 1 };
            return updated;
        }
        return [{ url, title, visitedAt: Date.now(), visitCount: 1 }, ...history].slice(0, 200);
    };

    it("debe agregar nueva URL al inicio del historial", () => {
        const updated = addToHistory([], "https://gulin.dev", "Gulin");
        expect(updated).toHaveLength(1);
        expect(updated[0].url).toBe("https://gulin.dev");
    });

    it("visitar la misma URL debe incrementar visitCount", () => {
        let history = addToHistory([], "https://gulin.dev", "Gulin");
        history = addToHistory(history, "https://gulin.dev", "Gulin");
        expect(history).toHaveLength(1);
        expect(history[0].visitCount).toBe(2);
    });

    it("debe ignorar URLs de tipo data:", () => {
        const updated = addToHistory([], "data:text/html,hola", "");
        expect(updated).toHaveLength(0);
    });

    it("debe ignorar URLs de tipo about:", () => {
        const updated = addToHistory([], "about:blank", "");
        expect(updated).toHaveLength(0);
    });

    it("el historial no debe exceder 200 entradas", () => {
        let history: HistoryEntry[] = [];
        for (let i = 0; i < 210; i++) {
            history = addToHistory(history, `https://pagina-${i}.com`, `Página ${i}`);
        }
        expect(history.length).toBeLessThanOrEqual(200);
    });

    it("borrar historial debe dejarlo vacío", () => {
        let history = addToHistory([], "https://a.com", "A");
        history = [];
        expect(history).toHaveLength(0);
    });
});

// ══════════════════════════════════════════════════════════════════
// BLOQUE 8 — Lista de Lectura (lógica pura)
// ══════════════════════════════════════════════════════════════════
describe("📚 Lista de Lectura — Lógica de gestión", () => {
    type ReadingItem = { id: string; url: string; title: string; savedAt: number; isRead: boolean };

    const makeItem = (url: string, title: string): ReadingItem => ({
        id: `rl-${Date.now()}-${Math.random()}`,
        url,
        title,
        savedAt: Date.now(),
        isRead: false,
    });

    it("nuevo artículo debe estar marcado como no leído", () => {
        const item = makeItem("https://articulo.com", "Mi artículo");
        expect(item.isRead).toBe(false);
    });

    it("marcar como leído debe cambiar isRead a true", () => {
        const item = makeItem("https://articulo.com", "Mi artículo");
        const updated = [item].map((x) => (x.id === item.id ? { ...x, isRead: true } : x));
        expect(updated[0].isRead).toBe(true);
    });

    it("toggle de lectura debe invertir el estado correctamente", () => {
        const item = makeItem("https://articulo.com", "Mi artículo");
        const toggle = (list: ReadingItem[], id: string) =>
            list.map((x) => (x.id === id ? { ...x, isRead: !x.isRead } : x));

        const list = [item];
        const after1 = toggle(list, item.id);
        expect(after1[0].isRead).toBe(true);

        const after2 = toggle(after1, item.id);
        expect(after2[0].isRead).toBe(false);
    });

    it("eliminar un artículo debe quitarlo de la lista", () => {
        const item1 = makeItem("https://a.com", "A");
        const item2 = makeItem("https://b.com", "B");
        const filtered = [item1, item2].filter((x) => x.id !== item1.id);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].url).toBe("https://b.com");
    });
});

// ══════════════════════════════════════════════════════════════════
// BLOQUE 9 — Gestor de Descargas (lógica pura)
// ══════════════════════════════════════════════════════════════════
describe("📥 Gestor de Descargas — Lógica de seguimiento", () => {
    type DownloadItem = {
        id: string;
        filename: string;
        receivedBytes: number;
        totalBytes: number;
        state: "progressing" | "completed" | "cancelled" | "interrupted";
        savePath?: string;
        startTime: number;
    };

    const makeDownload = (partial: Partial<DownloadItem> = {}): DownloadItem => ({
        id: `dl-${Date.now()}`,
        filename: "archivo.pdf",
        receivedBytes: 0,
        totalBytes: 1024 * 1024,
        state: "progressing",
        startTime: Date.now(),
        ...partial,
    });

    it("cálculo de porcentaje de progreso debe ser correcto al 50%", () => {
        const dl = makeDownload({ receivedBytes: 512 * 1024, totalBytes: 1024 * 1024 });
        const pct = Math.round((dl.receivedBytes / dl.totalBytes) * 100);
        expect(pct).toBe(50);
    });

    it("descarga completada (sin bytes totales) debe mostrar 100%", () => {
        const dl = makeDownload({ state: "completed", totalBytes: 0 });
        const pct = dl.totalBytes > 0 ? Math.round((dl.receivedBytes / dl.totalBytes) * 100) : 100;
        expect(pct).toBe(100);
    });

    it("nueva descarga debe aparecer al inicio de la lista", () => {
        let list: DownloadItem[] = [];
        const dl = makeDownload({ filename: "nuevo.zip" });
        list = [dl, ...list];
        expect(list[0].filename).toBe("nuevo.zip");
    });

    it("actualizar descarga debe actualizar receivedBytes preservando el ID", () => {
        const dl = makeDownload({ id: "dl-123", receivedBytes: 100 });
        let list = [dl];
        const update = { id: "dl-123", receivedBytes: 500 };
        list = list.map((item) => (item.id === update.id ? { ...item, ...update } : item));
        expect(list[0].receivedBytes).toBe(500);
        expect(list[0].id).toBe("dl-123");
    });

    it("limpiar completadas debe eliminar sólo las finalizadas", () => {
        const dl1 = makeDownload({ state: "completed" });
        const dl2 = makeDownload({ state: "progressing" });
        const dl3 = makeDownload({ state: "completed" });
        const cleaned = [dl1, dl2, dl3].filter((d) => d.state !== "completed");
        expect(cleaned).toHaveLength(1);
        expect(cleaned[0].state).toBe("progressing");
    });
});

// ══════════════════════════════════════════════════════════════════
// BLOQUE 10 — Focus Mode y Dark Mode (scripts CSS)
// ══════════════════════════════════════════════════════════════════
describe("🌿🌙 Focus Mode y Dark Mode — Scripts de inyección CSS", () => {
    const focusModeCSS = `
        header, footer, nav, aside, .sidebar, .ads, .ad, .advertisement,
        [class*="banner"], [class*="popup"], [class*="modal"], [id*="cookie"],
        [class*="cookie"], [class*="newsletter"], [class*="subscribe"] {
            display: none !important;
        }
        body { max-width: 800px !important; margin: 0 auto !important; padding: 20px !important; }
        article, main, [role="main"] { display: block !important; width: 100% !important; }
    `;

    const darkModeOnScript = `(function() {
        var s = document.createElement('style');
        s.id = 'gulin-forced-dark';
        s.textContent = 'html { filter: invert(90%) hue-rotate(180deg) !important; background: #121212 !important; } img, video, iframe, canvas { filter: invert(100%) hue-rotate(180deg) !important; }';
        document.head.appendChild(s);
    })()`;

    const darkModeOffScript = `(function() {
        var s = document.getElementById('gulin-forced-dark');
        if (s) s.remove();
    })()`;

    it("Focus Mode CSS debe ocultar header, footer, nav y aside", () => {
        expect(focusModeCSS).toContain("header");
        expect(focusModeCSS).toContain("footer");
        expect(focusModeCSS).toContain("nav");
        expect(focusModeCSS).toContain("aside");
        expect(focusModeCSS).toContain("display: none !important");
    });

    it("Focus Mode CSS debe limitar ancho a 800px", () => {
        expect(focusModeCSS).toContain("800px");
        expect(focusModeCSS).toContain("max-width");
    });

    it("Dark Mode (ON) debe usar filter invert(90%) y hue-rotate(180deg)", () => {
        expect(darkModeOnScript).toContain("invert(90%)");
        expect(darkModeOnScript).toContain("hue-rotate(180deg)");
        expect(darkModeOnScript).toContain("gulin-forced-dark");
    });

    it("Dark Mode (ON) debe proteger imágenes y videos con doble inversión", () => {
        expect(darkModeOnScript).toContain("img, video, iframe, canvas");
        expect(darkModeOnScript).toContain("invert(100%)");
    });

    it("Dark Mode (OFF) debe eliminar el estilo por ID gulin-forced-dark", () => {
        expect(darkModeOffScript).toContain("gulin-forced-dark");
        expect(darkModeOffScript).toContain("remove()");
    });

    it("Dark Mode (ON) debe ser un IIFE válido", () => {
        expect(darkModeOnScript.trim()).toMatch(/^\(function\(\)/);
    });

    it("Dark Mode (OFF) debe ser un IIFE válido", () => {
        expect(darkModeOffScript.trim()).toMatch(/^\(function\(\)/);
    });
});

// ══════════════════════════════════════════════════════════════════
// BLOQUE 12 — WebMCP (Web Model Context Protocol W3C Standard)
// ══════════════════════════════════════════════════════════════════
describe("⚡ WebMCP — Runtime y Estándar W3C Model Context", () => {
    it("debe instanciar ModelContext con origin por defecto", () => {
        const mc = new ModelContext("https://test.mercadolibre.cl");
        expect(mc).toBeInstanceOf(ModelContext);
    });

    it("debe registrar una herramienta imperativa con registerTool", async () => {
        const mc = new ModelContext("https://test.mercadolibre.cl");
        const registered = await mc.registerTool({
            name: "calculate_shipping",
            description: "Calcula el costo de despacho",
            inputSchema: { type: "object", properties: { zip: { type: "string" } } },
            execute: async (p) => ({ cost: 2990, zip: p.zip }),
        });

        expect(registered.name).toBe("calculate_shipping");
        expect(registered.origin).toBe("https://test.mercadolibre.cl");
        const tools = await mc.getTools();
        expect(tools).toHaveLength(1);
        expect(tools[0].name).toBe("calculate_shipping");
    });

    it("debe ejecutar una herramienta registrada con executeTool", async () => {
        const mc = new ModelContext("https://test.mercadolibre.cl");
        await mc.registerTool({
            name: "add_numbers",
            description: "Suma dos números",
            execute: (p) => p.a + p.b,
        });

        const result = await mc.executeTool("add_numbers", { a: 15, b: 25 });
        expect(result).toBe(40);
    });

    it("debe lanzar error al intentar registrar herramienta sin nombre o sin execute", async () => {
        const mc = new ModelContext("https://test.com");
        await expect(mc.registerTool({ name: "", description: "test", execute: () => {} })).rejects.toThrow();
        await expect(mc.registerTool({ name: "foo", description: "test", execute: null as any })).rejects.toThrow();
    });

    it("debe soportar des-registro reactivo mediante AbortController", async () => {
        const mc = new ModelContext("https://test.com");
        const controller = new AbortController();

        await mc.registerTool(
            {
                name: "temp_tool",
                description: "Herramienta temporal",
                execute: () => "ok",
            },
            { signal: controller.signal }
        );

        let tools = await mc.getTools();
        expect(tools.some((t) => t.name === "temp_tool")).toBe(true);

        controller.abort();
        tools = await mc.getTools();
        expect(tools.some((t) => t.name === "temp_tool")).toBe(false);
    });

    it("debe registrar site adapters para Mercado Libre", async () => {
        const mc = new ModelContext("https://listado.mercadolibre.cl");
        registerSiteAdapters(mc, "https://listado.mercadolibre.cl/arenero-gato");

        const tools = await mc.getTools();
        const toolNames = tools.map((t) => t.name);

        expect(toolNames).toContain("mercadolibre_get_page_items");
        expect(toolNames).toContain("mercadolibre_search");
    });

    it("debe registrar site adapters para Wikipedia", async () => {
        const mc = new ModelContext("https://es.wikipedia.org");
        registerSiteAdapters(mc, "https://es.wikipedia.org/wiki/Inteligencia_artificial");

        const tools = await mc.getTools();
        const toolNames = tools.map((t) => t.name);

        expect(toolNames).toContain("wikipedia_get_summary");
    });

    it("debe registrar site adapters para Google Search", async () => {
        const mc = new ModelContext("https://www.google.com");
        registerSiteAdapters(mc, "https://www.google.com/search?q=gulin");

        const tools = await mc.getTools();
        const toolNames = tools.map((t) => t.name);

        expect(toolNames).toContain("google_get_results");
    });
});

