// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export const READER_MODE_CSS = `
    #gulin-reader-overlay {
        position: fixed !important;
        inset: 0 !important;
        background: #191919 !important;
        color: #e6e6e6 !important;
        z-index: 9999999 !important;
        overflow-y: auto !important;
        padding: 40px 20px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    }
    #gulin-reader-container {
        max-width: 740px !important;
        margin: 0 auto !important;
        line-height: 1.8 !important;
        font-size: 19px !important;
    }
    #gulin-reader-container h1 {
        font-size: 32px !important;
        margin-bottom: 24px !important;
        color: #ffffff !important;
        line-height: 1.3 !important;
    }
    #gulin-reader-container p {
        margin-bottom: 20px !important;
        color: #cccccc !important;
    }
    #gulin-reader-container img {
        max-width: 100% !important;
        height: auto !important;
        border-radius: 8px !important;
        margin: 24px 0 !important;
    }
    #gulin-reader-close {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: #333333 !important;
        color: #ffffff !important;
        border: none !important;
        padding: 8px 16px !important;
        border-radius: 20px !important;
        cursor: pointer !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        z-index: 10000000 !important;
    }
    #gulin-reader-close:hover {
        background: #555555 !important;
    }
`;

export function toggleReaderModeScript(): string {
    return `(function() {
        var existing = document.getElementById('gulin-reader-overlay');
        if (existing) {
            existing.remove();
            return 'disabled';
        }

        var article = document.querySelector('article') || document.querySelector('main') || document.querySelector('[role="main"]');
        var title = document.querySelector('h1')?.innerText || document.title;
        var content = "";

        if (article) {
            content = article.innerHTML;
        } else {
            var paragraphs = Array.from(document.querySelectorAll('p'))
                .filter(p => p.innerText.trim().length > 60)
                .map(p => '<p>' + p.innerHTML + '</p>')
                .join('');
            content = paragraphs || '<div>No se pudo extraer el contenido principal.</div>';
        }

        var overlay = document.createElement('div');
        overlay.id = 'gulin-reader-overlay';
        overlay.innerHTML = 
            '<button id="gulin-reader-close" onclick="document.getElementById(\\'gulin-reader-overlay\\').remove()">✕ Salir del modo lectura</button>' +
            '<div id="gulin-reader-container">' +
            '<h1>' + title + '</h1>' +
            content +
            '</div>';

        var style = document.createElement('style');
        style.textContent = ${JSON.stringify(READER_MODE_CSS)};
        overlay.appendChild(style);

        document.body.appendChild(overlay);
        return 'enabled';
    })()`;
}
