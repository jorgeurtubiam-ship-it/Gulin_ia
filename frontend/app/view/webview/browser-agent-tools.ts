// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getApi } from "@/app/store/global";

export interface BrowserAgentTool {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
    execute: (model: any, params: any) => Promise<any>;
}

export const browserAgentTools: BrowserAgentTool[] = [
    {
        name: "browser_screenshot",
        description: "Captura una imagen (screenshot en PNG base64) de la página web que está abierta actualmente en el navegador de Gulin.",
        parameters: {
            type: "object",
            properties: {},
        },
        execute: async (model: any) => {
            const wcId = model.webviewRef?.current?.getWebContentsId();
            if (!wcId) throw new Error("No hay webview activo disponible.");
            const base64Data = await getApi().captureWebviewPage(wcId);
            return {
                status: "success",
                message: "Captura realizada exitosamente.",
                screenshot: base64Data,
            };
        },
    },
    {
        name: "browser_read_page",
        description: "Lee todo el texto visible del documento de la página web actual sin necesidad de procesar imagen.",
        parameters: {
            type: "object",
            properties: {
                maxCharacters: {
                    type: "number",
                    description: "Número máximo de caracteres a extraer (por defecto 15000).",
                },
            },
        },
        execute: async (model: any, params: any) => {
            const maxChars = params?.maxCharacters || 15000;
            const text = await model.webviewRef?.current?.executeJavaScript(
                `document.body.innerText.substring(0, ${maxChars})`
            );
            const title = await model.webviewRef?.current?.executeJavaScript(`document.title`);
            const url = model.getUrl?.() || "";
            return {
                status: "success",
                url,
                title,
                text,
            };
        },
    },
    {
        name: "browser_navigate",
        description: "Navega a una URL específica en el navegador web de Gulin.",
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "La dirección web a la que navegar (ejemplo: https://google.com).",
                },
            },
            required: ["url"],
        },
        execute: async (model: any, params: any) => {
            if (!params?.url) throw new Error("Parámetro 'url' requerido");
            await model.loadUrl(params.url, "browser-agent");
            return {
                status: "success",
                message: `Navegando a ${params.url}`,
            };
        },
    },
    {
        name: "browser_click",
        description: "Hace clic con el mouse en las coordenadas (x, y) de la página web.",
        parameters: {
            type: "object",
            properties: {
                x: { type: "number", description: "Coordenada X en píxeles dentro del visor web." },
                y: { type: "number", description: "Coordenada Y en píxeles dentro del visor web." },
            },
            required: ["x", "y"],
        },
        execute: async (model: any, params: any) => {
            const wcId = model.webviewRef?.current?.getWebContentsId();
            if (!wcId) throw new Error("No hay webview activo.");
            const x = Math.round(params.x);
            const y = Math.round(params.y);

            await getApi().webviewSendInput(wcId, {
                type: "mouseMove",
                x,
                y,
            });
            await getApi().webviewSendInput(wcId, {
                type: "mouseDown",
                x,
                y,
                button: "left",
                clickCount: 1,
            });
            await getApi().webviewSendInput(wcId, {
                type: "mouseUp",
                x,
                y,
                button: "left",
                clickCount: 1,
            });
            return {
                status: "success",
                message: `Clic realizado en coordenadas (${x}, ${y}).`,
            };
        },
    },
    {
        name: "browser_double_click",
        description: "Hace doble clic con el mouse en las coordenadas (x, y) de la página web.",
        parameters: {
            type: "object",
            properties: {
                x: { type: "number", description: "Coordenada X en píxeles." },
                y: { type: "number", description: "Coordenada Y en píxeles." },
            },
            required: ["x", "y"],
        },
        execute: async (model: any, params: any) => {
            const wcId = model.webviewRef?.current?.getWebContentsId();
            if (!wcId) throw new Error("No hay webview activo.");
            const x = Math.round(params.x);
            const y = Math.round(params.y);

            await getApi().webviewSendInput(wcId, {
                type: "mouseDown",
                x,
                y,
                button: "left",
                clickCount: 2,
            });
            await getApi().webviewSendInput(wcId, {
                type: "mouseUp",
                x,
                y,
                button: "left",
                clickCount: 2,
            });
            return {
                status: "success",
                message: `Doble clic realizado en coordenadas (${x}, ${y}).`,
            };
        },
    },
    {
        name: "browser_type",
        description: "Escribe texto carácter por carácter en el elemento actualmente enfocado en la página web.",
        parameters: {
            type: "object",
            properties: {
                text: { type: "string", description: "El texto a tipear." },
            },
            required: ["text"],
        },
        execute: async (model: any, params: any) => {
            const wcId = model.webviewRef?.current?.getWebContentsId();
            if (!wcId) throw new Error("No hay webview activo.");
            const text = params.text || "";

            for (const char of text) {
                await getApi().webviewSendInput(wcId, {
                    type: "char",
                    keyCode: char,
                });
                // Pausa aleatoria natural entre 20 y 45ms para emular cadencia humana
                await new Promise((r) => setTimeout(r, 20 + Math.random() * 25));
            }
            return {
                status: "success",
                message: `Texto escrito: "${text}"`,
            };
        },
    },
    {
        name: "browser_key",
        description: "Presiona una tecla especial en el navegador web (ejemplos: Return, Enter, Tab, Escape, Backspace, ArrowDown, ArrowUp).",
        parameters: {
            type: "object",
            properties: {
                key: {
                    type: "string",
                    description: "Nombre de la tecla (Enter, Tab, Escape, Backspace, ArrowDown, ArrowUp, Space, etc.)",
                },
            },
            required: ["key"],
        },
        execute: async (model: any, params: any) => {
            const wcId = model.webviewRef?.current?.getWebContentsId();
            if (!wcId) throw new Error("No hay webview activo.");
            const key = params.key;

            await getApi().webviewSendInput(wcId, {
                type: "keyDown",
                keyCode: key,
            });
            await getApi().webviewSendInput(wcId, {
                type: "keyUp",
                keyCode: key,
            });
            return {
                status: "success",
                message: `Tecla presionada: ${key}`,
            };
        },
    },
    {
        name: "browser_scroll",
        description: "Hace scroll en la página web actual (vertical u horizontal).",
        parameters: {
            type: "object",
            properties: {
                deltaX: { type: "number", description: "Desplazamiento horizontal en píxeles (positivo = derecha, negativo = izquierda)." },
                deltaY: { type: "number", description: "Desplazamiento vertical en píxeles (positivo = abajo, negativo = arriba)." },
            },
            required: ["deltaY"],
        },
        execute: async (model: any, params: any) => {
            const deltaX = params.deltaX || 0;
            const deltaY = params.deltaY || 0;
            await model.webviewRef?.current?.executeJavaScript(
                `window.scrollBy(${deltaX}, ${deltaY});`
            );
            return {
                status: "success",
                message: `Scroll realizado (${deltaX}px, ${deltaY}px).`,
            };
        },
    },
];

export function getBrowserAgentToolDefinitions() {
    return browserAgentTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
    }));
}

export async function executeBrowserAgentTool(toolName: string, params: any, model: any): Promise<any> {
    const tool = browserAgentTools.find((t) => t.name === toolName);
    if (!tool) {
        throw new Error(`Herramienta de navegador no encontrada: ${toolName}`);
    }
    return await tool.execute(model, params);
}
