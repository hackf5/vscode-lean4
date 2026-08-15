import type { InteractiveDiagnostic } from '@leanprover/infoview-api'
import * as React from 'react'
import { DiagnosticSeverity, type DocumentUri, type Location, type Range } from 'vscode-languageserver-protocol'

import { EditorContext, EnvPosContext } from '../contexts'
import { InteractiveMessage } from '../traceExplorer'
import { basename, type DocumentPosition } from '../util'

type MessageSeverity = 'error' | 'warning' | 'information' | 'hint' | 'message'

interface SeverityPresentation {
    kind: MessageSeverity
    label: string
    tallyLabel: string
    tallyPlural: string
}

function severityPresentation(severity: DiagnosticSeverity | undefined): SeverityPresentation {
    switch (severity) {
        case DiagnosticSeverity.Error:
            return { kind: 'error', label: 'Error', tallyLabel: 'error', tallyPlural: 'errors' }
        case DiagnosticSeverity.Warning:
            return { kind: 'warning', label: 'Warning', tallyLabel: 'warning', tallyPlural: 'warnings' }
        case DiagnosticSeverity.Information:
            return { kind: 'information', label: 'Information', tallyLabel: 'info', tallyPlural: 'info' }
        case DiagnosticSeverity.Hint:
            return { kind: 'hint', label: 'Hint', tallyLabel: 'hint', tallyPlural: 'hints' }
        default:
            return { kind: 'message', label: 'Message', tallyLabel: 'message', tallyPlural: 'messages' }
    }
}

function tallyLabel(messages: InteractiveDiagnostic[]): string {
    const presentations = [
        severityPresentation(DiagnosticSeverity.Error),
        severityPresentation(DiagnosticSeverity.Warning),
        severityPresentation(DiagnosticSeverity.Information),
        severityPresentation(DiagnosticSeverity.Hint),
        severityPresentation(undefined),
    ]
    return presentations
        .map(presentation => {
            const count = messages.filter(
                message => severityPresentation(message.severity).kind === presentation.kind,
            ).length
            if (count === 0) return undefined
            return `${count} ${count === 1 ? presentation.tallyLabel : presentation.tallyPlural}`
        })
        .filter(label => label !== undefined)
        .join(' · ')
}

function rangeKey(range: Range): string {
    return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`
}

function keyedMessages(messages: InteractiveDiagnostic[]): { key: string; message: InteractiveDiagnostic }[] {
    const occurrences = new Map<string, number>()
    return messages.map(message => {
        const base = [
            rangeKey(message.fullRange ?? message.range),
            message.severity ?? 'message',
            message.source ?? '',
            JSON.stringify(message.code ?? ''),
            JSON.stringify(message.message),
        ].join('|')
        const occurrence = occurrences.get(base) ?? 0
        occurrences.set(base, occurrence + 1)
        return { key: occurrence === 0 ? base : `${base}|${occurrence}`, message }
    })
}

function DiagnosticMessage({ uri, message }: { uri: DocumentUri; message: InteractiveDiagnostic }) {
    const editor = React.useContext(EditorContext)
    const headingId = React.useId()
    const severity = severityPresentation(message.severity)
    const fileName = basename(uri)
    const { line, character } = message.range.start
    const location: Location = { uri, range: message.range }
    const environmentPosition: DocumentPosition = { uri, ...(message.fullRange?.start ?? message.range.start) }
    const visibleLocation = `${fileName} · ${line + 1}:${character}`

    return (
        <li className="experimental-message-card__diagnostic" data-severity={severity.kind}>
            <section aria-labelledby={headingId}>
                <header className="experimental-message-card__diagnostic-header">
                    <h3 id={headingId}>{severity.label}</h3>
                    <button
                        type="button"
                        className="experimental-message-card__location"
                        onClick={() => void editor.revealLocation(location)}
                        aria-label={`Go to ${fileName}, line ${line + 1}, character ${character}`}
                    >
                        {visibleLocation}
                    </button>
                </header>
                <div className="experimental-message-card__body">
                    <EnvPosContext.Provider value={environmentPosition}>
                        <InteractiveMessage fmt={message.message} />
                    </EnvPosContext.Provider>
                </div>
            </section>
        </li>
    )
}

export function MessagesCard({ uri, messages }: { uri: DocumentUri; messages: InteractiveDiagnostic[] }) {
    const headingId = React.useId()

    return (
        <article className="experimental-message-card" aria-labelledby={headingId}>
            <header className="experimental-message-card__header">
                <h2 id={headingId}>Messages</h2>
                <span className="experimental-message-card__count">{tallyLabel(messages)}</span>
            </header>
            <ol className="experimental-message-card__list">
                {keyedMessages(messages).map(({ key, message }) => (
                    <DiagnosticMessage key={key} uri={uri} message={message} />
                ))}
            </ol>
        </article>
    )
}
