// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { loadMonaco } from "@/app/monaco/monaco-env";
import type * as MonacoTypes from "monaco-editor";
import * as monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import { debounce } from "throttle-debounce";

function getOrCreateModel(value: string, path: string, language?: string) {
    const uri = monaco.Uri.parse(`gulin://editor/${encodeURIComponent(path || "untitled")}`);
    const existing = monaco.editor.getModel(uri);
    if (existing && !existing.isDisposed()) {
        if (value !== undefined && existing.getValue() !== value) {
            existing.setValue(value ?? "");
        }
        if (language) {
            monaco.editor.setModelLanguage(existing, language);
        }
        return existing;
    }
    return monaco.editor.createModel(value ?? "", language, uri);
}

type CodeEditorProps = {
    text: string;
    readonly: boolean;
    language?: string;
    onChange?: (text: string) => void;
    onMount?: (editor: MonacoTypes.editor.IStandaloneCodeEditor, monacoApi: typeof monaco) => () => void;
    path: string;
    options: MonacoTypes.editor.IEditorOptions;
};

export function MonacoCodeEditor({ text, readonly, language, onChange, onMount, path, options }: CodeEditorProps) {
    const divRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<MonacoTypes.editor.IStandaloneCodeEditor | null>(null);
    const onUnmountRef = useRef<(() => void) | null>(null);
    const applyingFromProps = useRef(false);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        loadMonaco();

        const el = divRef.current;
        if (!el) return;

        const model = getOrCreateModel(text, path, language);

        const editor = monaco.editor.create(el, {
            ...options,
            readOnly: readonly,
            model,
            automaticLayout: true,
        });
        editorRef.current = editor;

        const sub = editor.onDidChangeModelContent(() => {
            if (applyingFromProps.current) return;
            const currentModel = editor.getModel();
            if (currentModel) {
                onChangeRef.current?.(currentModel.getValue());
            }
        });

        if (onMount) {
            onUnmountRef.current = onMount(editor, monaco);
        }

        const debouncedLayout = debounce(50, () => {
            if (editorRef.current) {
                editorRef.current.layout();
            }
        });
        const resizeObserver = new ResizeObserver(debouncedLayout);
        resizeObserver.observe(el);

        requestAnimationFrame(() => {
            if (editorRef.current) {
                editorRef.current.layout();
            }
        });
        const timer1 = setTimeout(() => {
            if (editorRef.current) {
                editorRef.current.layout();
            }
        }, 50);
        const timer2 = setTimeout(() => {
            if (editorRef.current) {
                editorRef.current.layout();
            }
        }, 200);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            resizeObserver.disconnect();
            debouncedLayout.cancel();
            sub.dispose();
            if (onUnmountRef.current) {
                onUnmountRef.current();
                onUnmountRef.current = null;
            }
            editor.dispose();
            editorRef.current = null;
        };
    }, []);

    // Switch model when path changes
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        const model = getOrCreateModel(text, path, language);
        if (editor.getModel() !== model) {
            editor.setModel(model);
        }
        editor.layout();
    }, [path]);

    // Keep model value in sync with props
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const model = editor.getModel();
        if (!model) return;

        const current = model.getValue();
        if (current === text) return;

        applyingFromProps.current = true;
        model.pushEditOperations([], [{ range: model.getFullModelRange(), text: text ?? "" }], () => null);
        applyingFromProps.current = false;
    }, [text]);

    // Keep options in sync
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.updateOptions({ ...options, readOnly: readonly });
    }, [options, readonly]);

    // Keep language in sync
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const model = editor.getModel();
        if (!model || !language) return;
        monaco.editor.setModelLanguage(model, language);
    }, [language]);

    return <div className="flex flex-col h-full w-full flex-1 min-h-0" ref={divRef} style={{ width: "100%", height: "100%", flex: 1 }} />;
}

type DiffViewerProps = {
    original: string;
    modified: string;
    language?: string;
    path: string;
    options: MonacoTypes.editor.IDiffEditorOptions;
};

export function MonacoDiffViewer({ original, modified, language, path, options }: DiffViewerProps) {
    const divRef = useRef<HTMLDivElement>(null);
    const diffRef = useRef<MonacoTypes.editor.IStandaloneDiffEditor | null>(null);

    // Create once
    useEffect(() => {
        loadMonaco();

        const el = divRef.current;
        if (!el) return;

        const origUri = monaco.Uri.parse(`gulin://diff/${encodeURIComponent(path)}.orig`);
        const modUri = monaco.Uri.parse(`gulin://diff/${encodeURIComponent(path)}.mod`);

        const originalModel = monaco.editor.createModel(original, language, origUri);
        const modifiedModel = monaco.editor.createModel(modified, language, modUri);

        const diff = monaco.editor.createDiffEditor(el, options);
        diffRef.current = diff;

        diff.setModel({ original: originalModel, modified: modifiedModel });

        return () => {
            diff.dispose();
            originalModel.dispose();
            modifiedModel.dispose();
            diffRef.current = null;
        };
    }, []);

    useEffect(() => {
        const diff = diffRef.current;
        const el = divRef.current;
        if (!diff || !el) return;

        const debouncedLayout = debounce(100, () => {
            diff.layout();
        });
        const resizeObserver = new ResizeObserver(debouncedLayout);
        resizeObserver.observe(el);

        return () => {
            resizeObserver.disconnect();
            debouncedLayout.cancel();
        };
    }, []);

    // Update models on prop change
    useEffect(() => {
        const diff = diffRef.current;
        if (!diff) return;
        const model = diff.getModel();
        if (!model) return;

        if (model.original.getValue() !== original) model.original.setValue(original);
        if (model.modified.getValue() !== modified) model.modified.setValue(modified);

        if (language) {
            monaco.editor.setModelLanguage(model.original, language);
            monaco.editor.setModelLanguage(model.modified, language);
        }
    }, [original, modified, language]);

    useEffect(() => {
        const diff = diffRef.current;
        if (!diff) return;
        diff.updateOptions(options);
    }, [options]);

    return <div className="flex flex-col h-full w-full" ref={divRef} />;
}
