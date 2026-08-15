import { getInteractiveTermGoal, type InteractiveTermGoal } from '@leanprover/infoview-api'
import type {
    DidChangeTextDocumentParams,
    Location,
    Position,
    TextDocumentPositionParams,
} from 'vscode-languageserver-protocol'

import { useRpcSessionAtTdpp } from '../rpcSessions'
import { discardMethodNotFound, useAsync, useClientNotificationState } from '../util'
import { getInteractiveGoalSnapshot, type InteractiveGoalSnapshot } from './rpc'

export interface InteractivePositionSnapshot {
    queryPosition: Position
    scopedGoals?: InteractiveGoalSnapshot
    expectedType?: InteractiveTermGoal
}

export function usePositionSnapshot(location: Location) {
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
    const result = useAsync<InteractivePositionSnapshot>(
        async abortSignal => {
            const [scopedGoals, expectedType] = await Promise.all([
                getInteractiveGoalSnapshot(session, params, { abortSignal }).catch(error =>
                    discardMethodNotFound(error),
                ),
                getInteractiveTermGoal(session, params, { abortSignal }),
            ])
            return { queryPosition: params.position, scopedGoals, expectedType }
        },
        [session, params.textDocument.uri, params.position.line, params.position.character, documentRevision],
    )
    return { documentRevision, result }
}
