// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export function getClipPageScript(): string {
    return `(function() {
        var title = document.title || 'Página Web';
        var url = window.location.href;
        var selection = window.getSelection().toString();
        var mainElem = document.querySelector('article') || document.querySelector('main') || document.body;
        var content = selection || mainElem.innerText || '';

        return JSON.stringify({
            title: title,
            url: url,
            content: content.substring(0, 25000),
            date: new Date().toISOString()
        });
    })()`;
}

export function formatAsMarkdown(data: { title: string; url: string; content: string; date: string }): string {
    return `---
title: "${data.title.replace(/"/g, '\\"')}"
url: "${data.url}"
date: "${data.date}"
source: "Gulin Web Clipper"
---

# ${data.title}

> **Fuente:** [${data.url}](${data.url})  
> **Fecha de captura:** ${new Date(data.date).toLocaleString()}

---

${data.content}
`;
}
