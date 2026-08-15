import type { DidChangeTextDocumentParams, Location, TextDocumentPositionParams } from 'vscode-languageserver-protocol'

import { useRpcSessionAtTdpp } from '../rpcSessions'
import { discardMethodNotFound, useAsync, useClientNotificationState } from '../util'
import { getInteractiveGoalSnapshot, InteractiveGoalSnapshot } from './rpc'

export function useGoalSnapshot(location: Location) {
    const params: TextDocumentPositionParams = {
        textDocument: { uri: location.uri },
        position: location.range.start,
    }
    const session = useRpcSessionAtTdpp(params)
    const [documentRevision] = useClientNotificationState<number, DidChangeTextDocumentParams>(
        'textDocument/didChange',
        0,
        (revision, change) => (change.textDocument.uri === location.uri ? revision + 1 : revision),
        [location.uri],
    )
    const result = useAsync<InteractiveGoalSnapshot | undefined>(
        abortSignal =>
            getInteractiveGoalSnapshot(session, params, { abortSignal }).catch(error => discardMethodNotFound(error)),
        [session, params.textDocument.uri, params.position.line, params.position.character, documentRevision],
    )
    return { documentRevision, result }
}
