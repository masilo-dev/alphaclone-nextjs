'use client';

import React, { useEffect, useRef } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';

interface BlockNoteEditorWrapperProps {
    pageId: string;
    initialContent: any[];
    onChange: (content: any[]) => void;
}

export default function BlockNoteEditorWrapper({
    pageId,
    initialContent,
    onChange,
}: BlockNoteEditorWrapperProps) {
    const editor = useCreateBlockNote({
        initialContent: initialContent?.length > 0 ? initialContent : undefined,
    });

    return (
        <div className="blocknote-pages-wrapper px-6 pb-16 pt-4">
            <style>{`
                .blocknote-pages-wrapper .bn-container {
                    background: transparent !important;
                    color: #e2e8f0 !important;
                }
                .blocknote-pages-wrapper .bn-editor {
                    background: transparent !important;
                    color: #e2e8f0 !important;
                    font-size: 15px;
                    line-height: 1.7;
                    max-width: 720px;
                    margin: 0 auto;
                    padding: 0 1rem;
                }
                .blocknote-pages-wrapper [data-node-type="blockContainer"] {
                    color: #e2e8f0 !important;
                }
                .blocknote-pages-wrapper .bn-block-content p,
                .blocknote-pages-wrapper .bn-block-content h1,
                .blocknote-pages-wrapper .bn-block-content h2,
                .blocknote-pages-wrapper .bn-block-content h3,
                .blocknote-pages-wrapper .bn-block-content li {
                    color: #e2e8f0 !important;
                }
                .blocknote-pages-wrapper .bn-block-content h1 { font-size: 1.75rem; font-weight: 700; }
                .blocknote-pages-wrapper .bn-block-content h2 { font-size: 1.375rem; font-weight: 600; }
                .blocknote-pages-wrapper .bn-block-content h3 { font-size: 1.125rem; font-weight: 600; }
                .blocknote-pages-wrapper [contenteditable]::before {
                    color: #475569 !important;
                }
                .blocknote-pages-wrapper .bn-slash-menu,
                .blocknote-pages-wrapper .bn-suggestion-menu {
                    background: #1e293b !important;
                    border: 1px solid #334155 !important;
                    border-radius: 12px !important;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.6) !important;
                    color: #e2e8f0 !important;
                }
                .blocknote-pages-wrapper .bn-slash-menu-item:hover,
                .blocknote-pages-wrapper .bn-suggestion-menu-item:hover,
                .blocknote-pages-wrapper .bn-slash-menu-item[aria-selected="true"],
                .blocknote-pages-wrapper .bn-suggestion-menu-item[aria-selected="true"] {
                    background: #0f766e33 !important;
                    color: #5eead4 !important;
                }
                .blocknote-pages-wrapper .bn-toolbar {
                    background: #1e293b !important;
                    border: 1px solid #334155 !important;
                    border-radius: 8px !important;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
                }
                .blocknote-pages-wrapper .bn-toolbar button {
                    color: #94a3b8 !important;
                }
                .blocknote-pages-wrapper .bn-toolbar button:hover {
                    background: #334155 !important;
                    color: #e2e8f0 !important;
                }
                .blocknote-pages-wrapper .mantine-Select-dropdown {
                    background: #1e293b !important;
                    border: 1px solid #334155 !important;
                    border-radius: 8px !important;
                }
            `}</style>
            <BlockNoteView
                editor={editor}
                theme="dark"
                onChange={() => onChange(editor.document as any[])}
            />
        </div>
    );
}
