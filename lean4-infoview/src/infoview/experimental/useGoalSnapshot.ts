import type { Location, TextDocumentPositionParams } from 'vscode-languageserver-protocol'

import { useRpcSessionAtTdpp } from '../rpcSessions'
import { discardMethodNotFound, useAsync } from '../util'
import { getInteractiveGoalSnapshot, InteractiveGoalSnapshot } from './rpc'

export function useGoalSnapshot(location: Location) {
    const params: TextDocumentPositionParams = {
        textDocument: { uri: location.uri },
        position: location.range.start,
    }
    const session = useRpcSessionAtTdpp(params)
    return useAsync<InteractiveGoalSnapshot | undefined>(
        abortSignal =>
            getInteractiveGoalSnapshot(session, params, { abortSignal }).catch(error => discardMethodNotFound(error)),
        [session, params.textDocument.uri, params.position.line, params.position.character],
    )
}
