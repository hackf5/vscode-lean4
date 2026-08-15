import {
    getInteractiveDiagnostics,
    getInteractiveGoals,
    getInteractiveTermGoal,
    type InteractiveDiagnostic,
    type InteractiveGoals,
    type InteractiveTermGoal,
    type LeanDiagnostic,
    type UserWidgetInstance,
    Widget_getWidgets,
} from '@leanprover/infoview-api'
import * as React from 'react'
import type {
    DidChangeTextDocumentParams,
    Location,
    Position,
    TextDocumentPositionParams,
} from 'vscode-languageserver-protocol'

import { ConfigContext, LspDiagnosticsContext } from '../contexts'
import { useRpcSessionAtTdpp } from '../rpcSessions'
import { discardMethodNotFound, RangeHelpers, useAsync, useClientNotificationState } from '../util'
import { getInteractiveGoalSnapshot, type InteractiveGoalSnapshot } from './rpc'

export interface InteractivePositionSnapshot {
    queryPosition: Position
    scopedGoals?: InteractiveGoalSnapshot
    widgetGoals?: InteractiveGoals
    expectedType?: InteractiveTermGoal
    widgets: UserWidgetInstance[]
    messages: InteractiveDiagnostic[]
}

function lspDiagnosticToInteractive(diagnostic: LeanDiagnostic): InteractiveDiagnostic {
    return { ...diagnostic, message: { text: diagnostic.message } }
}

function visibleDiagnostics(diagnostics: InteractiveDiagnostic[]): InteractiveDiagnostic[] {
    return diagnostics.filter(diagnostic => diagnostic.isSilent !== true)
}

export function usePositionSnapshot(location: Location) {
    const params: TextDocumentPositionParams = {
        textDocument: { uri: location.uri },
        position: location.range.start,
    }
    const session = useRpcSessionAtTdpp(params)
    const config = React.useContext(ConfigContext)
    const lspDiagnostics = React.useContext(LspDiagnosticsContext)
    const fallbackMessages = React.useMemo(
        () =>
            (lspDiagnostics.get(location.uri) ?? [])
                .filter(
                    diagnostic =>
                        diagnostic.isSilent !== true &&
                        RangeHelpers.contains(
                            diagnostic.fullRange ?? diagnostic.range,
                            params.position,
                            config.allErrorsOnLine,
                        ),
                )
                .map(lspDiagnosticToInteractive),
        [config.allErrorsOnLine, location.uri, lspDiagnostics, params.position],
    )
    const [documentRevision] = useClientNotificationState<number, DidChangeTextDocumentParams>(
        'textDocument/didChange',
        0,
        (revision, change) => (change.textDocument.uri === location.uri ? revision + 1 : revision),
        [location.uri],
    )
    const result = useAsync<InteractivePositionSnapshot>(
        async abortSignal => {
            const messagesRequest = getInteractiveDiagnostics(
                session,
                { start: params.position.line, end: params.position.line + 1 },
                { abortSignal },
            )
                .then(diagnostics => {
                    const messages = visibleDiagnostics(diagnostics)
                    return messages.length > 0 ? messages : fallbackMessages
                })
                .catch(error => {
                    if (abortSignal.aborted) throw error
                    return fallbackMessages
                })
            const [scopedGoals, widgetGoals, expectedType, widgets, messages] = await Promise.all([
                getInteractiveGoalSnapshot(session, params, { abortSignal }).catch(error =>
                    discardMethodNotFound(error),
                ),
                getInteractiveGoals(session, params, { abortSignal }),
                getInteractiveTermGoal(session, params, { abortSignal }),
                Widget_getWidgets(session, params.position, { abortSignal }).catch(discardMethodNotFound),
                messagesRequest,
            ])
            return {
                queryPosition: params.position,
                scopedGoals,
                widgetGoals,
                expectedType,
                widgets: widgets?.widgets ?? [],
                messages,
            }
        },
        [
            session,
            params.textDocument.uri,
            params.position.line,
            params.position.character,
            documentRevision,
            fallbackMessages,
        ],
    )
    return { documentRevision, result }
}
