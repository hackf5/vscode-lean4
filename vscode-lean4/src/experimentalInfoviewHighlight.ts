import type { ExperimentalInfoviewSourceHighlight } from '@leanprover/infoview-api'
import {
    DecorationRangeBehavior,
    Disposable,
    Range,
    TextEditor,
    TextEditorDecorationType,
    ThemeColor,
    window,
    workspace,
} from 'vscode'

import { p2cConverter } from './utils/converters'
import { ExtUri, extUriEquals, parseExtUri } from './utils/exturi'
import { lean, LeanEditor } from './utils/leanEditorProvider'

interface SourceHighlight {
    uri: ExtUri
    scopeRanges: readonly Range[]
    tacticRanges: readonly Range[]
}

/** Owns the editor decorations requested by the experimental Infoview. */
export class ExperimentalInfoviewHighlightController implements Disposable {
    private readonly scopeDecorationType: TextEditorDecorationType
    private readonly tacticDecorationType: TextEditorDecorationType
    private readonly subscriptions: Disposable[] = []
    private current: SourceHighlight | undefined
    private visible = false

    constructor() {
        this.scopeDecorationType = window.createTextEditorDecorationType({
            isWholeLine: true,
            backgroundColor: new ThemeColor('editor.rangeHighlightBackground'),
            borderColor: new ThemeColor('editor.rangeHighlightBorder'),
            borderStyle: 'solid',
            borderWidth: '0 0 0 2px',
            rangeBehavior: DecorationRangeBehavior.OpenOpen,
        })
        this.tacticDecorationType = window.createTextEditorDecorationType({
            backgroundColor: new ThemeColor('editor.wordHighlightStrongBackground'),
            borderColor: new ThemeColor('editor.wordHighlightStrongBorder'),
            borderStyle: 'solid',
            borderWidth: '1px',
            rangeBehavior: DecorationRangeBehavior.OpenOpen,
        })

        this.subscriptions.push(
            lean.onDidRevealLeanEditor(editor => this.onDidRevealEditor(editor)),
            window.onDidChangeActiveTextEditor(editor => {
                // VS Code reports no active text editor while the Infoview itself has focus.
                if (this.current && editor && !this.current.uri.equalsUri(editor.document.uri)) {
                    this.clear()
                }
            }),
            workspace.onDidChangeTextDocument(event => {
                if (this.current?.uri.equalsUri(event.document.uri)) {
                    this.clear()
                }
            }),
        )
    }

    setVisible(visible: boolean): void {
        if (this.visible === visible) return
        this.visible = visible
        if (visible) {
            this.renderCurrent()
        } else {
            this.clearRendered()
        }
    }

    setHighlight(highlight: ExperimentalInfoviewSourceHighlight | undefined): void {
        this.clearRendered()
        if (!highlight) {
            this.current = undefined
            return
        }

        const uri = parseExtUri(highlight.uri)
        if (!uri) {
            this.current = undefined
            return
        }

        this.current = {
            uri,
            scopeRanges: highlight.scopeRanges.map(range => p2cConverter.asRange(range)),
            tacticRanges: highlight.tacticRanges.map(range => p2cConverter.asRange(range)),
        }
        this.renderCurrent()
    }

    clear(): void {
        this.setHighlight(undefined)
    }

    private setEditorDecorations(editor: TextEditor, highlight: SourceHighlight): void {
        editor.setDecorations(this.scopeDecorationType, highlight.scopeRanges)
        editor.setDecorations(this.tacticDecorationType, highlight.tacticRanges)
    }

    private clearEditor(editor: TextEditor): void {
        editor.setDecorations(this.scopeDecorationType, [])
        editor.setDecorations(this.tacticDecorationType, [])
    }

    private renderCurrent(): void {
        if (!this.visible || !this.current) return
        for (const editor of lean.getVisibleLeanEditorsByUri(this.current.uri)) {
            this.setEditorDecorations(editor.editor, this.current)
        }
    }

    private clearRendered(): void {
        for (const editor of lean.visibleLeanEditors) {
            this.clearEditor(editor.editor)
        }
    }

    private onDidRevealEditor(editor: LeanEditor): void {
        this.clearEditor(editor.editor)
        if (this.visible && this.current && extUriEquals(editor.documentExtUri, this.current.uri)) {
            this.setEditorDecorations(editor.editor, this.current)
        }
    }

    dispose(): void {
        for (const subscription of this.subscriptions) subscription.dispose()
        this.scopeDecorationType.dispose()
        this.tacticDecorationType.dispose()
    }
}
