import {
    CodeWithInfos,
    InteractiveGoal,
    InteractiveHypothesisBundle,
    InteractiveHypothesisBundle_nonAnonymousNames,
    InteractiveTermGoal,
} from '@leanprover/infoview-api'
import * as React from 'react'

import { InteractiveCode } from '../interactiveCode'
import type { InteractiveGoalState } from './rpc'

type ChangeKind = 'added' | 'removed' | 'changed'

function hasDiff(fmt: CodeWithInfos): boolean {
    if ('text' in fmt) return false
    if ('append' in fmt) return fmt.append.some(hasDiff)
    return fmt.tag[0].diffStatus !== undefined || hasDiff(fmt.tag[1])
}

function changeKind(
    value: { isInserted?: boolean; isRemoved?: boolean },
    expressions: (CodeWithInfos | undefined)[],
): ChangeKind | undefined {
    if (value.isInserted) return 'added'
    if (value.isRemoved) return 'removed'
    if (expressions.some(expression => expression !== undefined && hasDiff(expression))) return 'changed'
    return undefined
}

function ChangeMarker({ kind }: { kind: ChangeKind }) {
    const label = kind[0].toUpperCase() + kind.slice(1)
    return (
        <span className={`experimental-proof-card__change experimental-proof-card__change--${kind}`}>
            <span aria-hidden="true" />
            {label}
        </span>
    )
}

function hypothesisKey(hypothesis: InteractiveHypothesisBundle, index: number): string {
    return hypothesis.fvarIds && hypothesis.fvarIds.length > 0 ? hypothesis.fvarIds.join(':') : `hypothesis-${index}`
}

function isInaccessibleName(name: string): boolean {
    return name.includes('✝')
}

function inaccessibleBaseName(name: string): string {
    const daggerIndex = name.indexOf('✝')
    return daggerIndex < 0 ? name : name.slice(0, daggerIndex)
}

const superscriptDigits: Record<string, string> = {
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9',
}

function inaccessibleNameIndex(name: string): string | undefined {
    const daggerIndex = name.indexOf('✝')
    if (daggerIndex < 0) return undefined

    const suffix = name.slice(daggerIndex + 1)
    if (suffix.length === 0) return '0'

    let index = ''
    for (const digit of suffix) {
        const ordinaryDigit = superscriptDigits[digit]
        if (ordinaryDigit === undefined) return undefined
        index += ordinaryDigit
    }
    return index
}

function shadowedHypothesisNames(contexts: InteractiveHypothesisBundle[][]): ReadonlySet<string> {
    const shadowed = new Set<string>()
    for (const context of contexts) {
        const names = context.flatMap(InteractiveHypothesisBundle_nonAnonymousNames)
        const accessibleNames = new Set(names.filter(name => !isInaccessibleName(name)))
        for (const name of names) {
            if (isInaccessibleName(name) && accessibleNames.has(inaccessibleBaseName(name))) shadowed.add(name)
        }
    }
    return shadowed
}

interface HypothesisNameParts {
    visible: string[]
    hidden: string[]
    anonymousCount: number
}

function hypothesisNameParts(hypothesis: InteractiveHypothesisBundle): HypothesisNameParts {
    const nonAnonymous = InteractiveHypothesisBundle_nonAnonymousNames(hypothesis)
    if (!hypothesis.isInstance) {
        return {
            visible: nonAnonymous,
            hidden: [],
            anonymousCount: hypothesis.names.length - nonAnonymous.length,
        }
    }
    return {
        visible: nonAnonymous.filter(name => !isInaccessibleName(name)),
        hidden: nonAnonymous.filter(isInaccessibleName),
        anonymousCount: hypothesis.names.length - nonAnonymous.length,
    }
}

function HypothesisExpression({ hypothesis }: { hypothesis: InteractiveHypothesisBundle }) {
    return (
        <>
            <InteractiveCode fmt={hypothesis.type} />
            {hypothesis.val && (
                <>
                    <span className="experimental-proof-card__definition" aria-label="defined as">
                        {' '}
                        :={' '}
                    </span>
                    <InteractiveCode fmt={hypothesis.val} />
                </>
            )}
        </>
    )
}

function OrdinaryHypothesisRow({
    hypothesis,
    names,
    shadowedNames,
}: {
    hypothesis: InteractiveHypothesisBundle
    names: string[]
    shadowedNames: ReadonlySet<string>
}) {
    const change = changeKind(hypothesis, [hypothesis.type, hypothesis.val])

    return (
        <div className="experimental-proof-card__hypothesis">
            <dt>
                <span
                    className="experimental-proof-card__instance-marker experimental-proof-card__instance-marker--placeholder"
                    aria-hidden="true"
                >
                    []
                </span>
                <span className="experimental-proof-card__hypothesis-name">
                    <code>
                        {names.length > 0 ? (
                            names.map((name, index) => (
                                <React.Fragment key={`${name}|${index}`}>
                                    {index > 0 && ' '}
                                    {shadowedNames.has(name) ? (
                                        <>
                                            <s className="experimental-proof-card__shadowed-name" aria-hidden="true">
                                                {inaccessibleBaseName(name)}
                                            </s>
                                            <span className="experimental-proof-card__visually-hidden">
                                                {inaccessibleBaseName(name)}, shadowed
                                            </span>
                                        </>
                                    ) : (
                                        name
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <span aria-label="anonymous assumption">_</span>
                        )}
                    </code>
                    {change && <ChangeMarker kind={change} />}
                </span>
            </dt>
            <dd>
                <HypothesisExpression hypothesis={hypothesis} />
            </dd>
        </div>
    )
}

function InstanceHypothesisRow({
    hypothesis,
    names,
    anonymous,
    anonymousIndex,
}: {
    hypothesis: InteractiveHypothesisBundle
    names: string[]
    anonymous: boolean
    anonymousIndex?: string
}) {
    const change = changeKind(hypothesis, [hypothesis.type, hypothesis.val])
    const marker = anonymousIndex === undefined ? '[]' : `[${anonymousIndex}]`

    return (
        <div
            className={`experimental-proof-card__hypothesis experimental-proof-card__instance-binder${
                anonymous ? ' experimental-proof-card__instance-binder--anonymous' : ''
            }`}
        >
            <dt>
                <span className="experimental-proof-card__instance-marker" aria-hidden="true">
                    {marker}
                </span>
                <span className="experimental-proof-card__hypothesis-name">
                    <span className="experimental-proof-card__visually-hidden">
                        {anonymous
                            ? `Anonymous instance parameter${
                                  anonymousIndex === undefined ? '' : `, Lean index ${anonymousIndex}`
                              }`
                            : 'Instance parameter '}
                    </span>
                    {!anonymous && <code>{names.join(' ')}</code>}
                </span>
            </dt>
            <dd>
                <HypothesisExpression hypothesis={hypothesis} />
                {change && <ChangeMarker kind={change} />}
            </dd>
        </div>
    )
}

function HypothesisRows({
    hypothesis,
    shadowedNames,
}: {
    hypothesis: InteractiveHypothesisBundle
    shadowedNames: ReadonlySet<string>
}) {
    const names = hypothesisNameParts(hypothesis)
    if (!hypothesis.isInstance)
        return <OrdinaryHypothesisRow hypothesis={hypothesis} names={names.visible} shadowedNames={shadowedNames} />

    const unindexedCount = Math.max(
        names.anonymousCount,
        names.visible.length === 0 && names.hidden.length === 0 ? 1 : 0,
    )
    return (
        <>
            {names.visible.length > 0 && (
                <InstanceHypothesisRow hypothesis={hypothesis} names={names.visible} anonymous={false} />
            )}
            {names.hidden.map((name, index) => (
                <InstanceHypothesisRow
                    key={`${name}|${index}`}
                    hypothesis={hypothesis}
                    names={[]}
                    anonymous
                    anonymousIndex={inaccessibleNameIndex(name)}
                />
            ))}
            {Array.from({ length: unindexedCount }, (_, index) => (
                <InstanceHypothesisRow key={`anonymous|${index}`} hypothesis={hypothesis} names={[]} anonymous />
            ))}
        </>
    )
}

function Context({
    hypotheses,
    nameScopes = [hypotheses],
}: {
    hypotheses: InteractiveHypothesisBundle[]
    nameScopes?: InteractiveHypothesisBundle[][]
}) {
    if (hypotheses.length === 0) return null
    const shadowedNames = shadowedHypothesisNames(nameScopes)

    return (
        <div className="experimental-proof-card__context">
            <div className="experimental-proof-card__assumptions">
                <dl>
                    {hypotheses.map((hypothesis, index) => (
                        <React.Fragment key={hypothesisKey(hypothesis, index)}>
                            <HypothesisRows hypothesis={hypothesis} shadowedNames={shadowedNames} />
                        </React.Fragment>
                    ))}
                </dl>
            </div>
        </div>
    )
}

function sameHypothesisIdentity(left: InteractiveHypothesisBundle, right: InteractiveHypothesisBundle): boolean {
    if (!left.fvarIds || left.fvarIds.length === 0 || !right.fvarIds || right.fvarIds.length === 0) return false
    return (
        left.fvarIds.length === right.fvarIds.length && left.fvarIds.every((id, index) => id === right.fvarIds![index])
    )
}

function sharedContextLength(contexts: InteractiveHypothesisBundle[][]): number {
    if (contexts.length === 0) return 0
    if (contexts.length === 1) return contexts[0].length

    const first = contexts[0]
    let length = 0
    while (
        length < first.length &&
        contexts
            .slice(1)
            .every(context =>
                context.length > length ? sameHypothesisIdentity(first[length], context[length]) : false,
            )
    ) {
        length += 1
    }
    return length
}

function goalKey(goal: InteractiveGoal, index: number): string {
    return goal.mvarId ?? `goal-${index}`
}

function goalCountLabel(count: number): string {
    if (count === 0) return 'No goals'
    if (count === 1) return '1 goal'
    return `${count} goals`
}

function tacticLabel(state: InteractiveGoalState): { display: string; exact?: string } {
    const exact = state.tacticText
    if (!exact) return { display: 'Selected tactic' }
    return { display: exact.replace(/\s+/g, ' ').trim() || 'Selected tactic', exact }
}

function Target({ goal, change }: { goal: InteractiveGoal; change?: ChangeKind }) {
    return (
        <div className="experimental-proof-card__target">
            <div className="experimental-proof-card__target-heading">
                <span>Target</span>
                {change && <ChangeMarker kind={change} />}
            </div>
            <div className="experimental-proof-card__target-expression">
                <span className="experimental-proof-card__turnstile" aria-hidden="true">
                    {goal.goalPrefix}
                </span>
                <InteractiveCode fmt={goal.type} />
            </div>
        </div>
    )
}

function ExpectedType({ expectedType, sharedCount }: { expectedType: InteractiveTermGoal; sharedCount: number }) {
    const headingId = React.useId()

    return (
        <section className="experimental-proof-card__phase" aria-labelledby={headingId}>
            <h3 id={headingId} className="experimental-proof-card__phase-heading">
                Expected type
            </h3>
            <Context hypotheses={expectedType.hyps.slice(sharedCount)} nameScopes={[expectedType.hyps]} />
            <div className="experimental-proof-card__expected-expression">
                <span className="experimental-proof-card__turnstile" aria-hidden="true">
                    ⊢{' '}
                </span>
                <InteractiveCode fmt={expectedType.type} />
            </div>
        </section>
    )
}

function Goal({
    goal,
    index,
    count,
    sharedCount,
}: {
    goal: InteractiveGoal
    index: number
    count: number
    sharedCount: number
}) {
    const headingId = React.useId()
    const goalChange = goal.isInserted ? 'added' : goal.isRemoved ? 'removed' : undefined
    const targetChange = goalChange ? undefined : changeKind({}, [goal.type])
    const hasVisibleHeading = count > 1 || goal.userName !== undefined || goalChange !== undefined

    return (
        <section className="experimental-proof-card__goal" aria-labelledby={headingId}>
            <div
                className={
                    hasVisibleHeading
                        ? 'experimental-proof-card__goal-heading'
                        : 'experimental-proof-card__goal-heading experimental-proof-card__visually-hidden'
                }
            >
                <h4 id={headingId}>{count > 1 ? `Goal ${index + 1}` : 'Goal'}</h4>
                {goal.userName && <code>case {goal.userName}</code>}
                {goalChange && <ChangeMarker kind={goalChange} />}
            </div>
            <Context hypotheses={goal.hyps.slice(sharedCount)} nameScopes={[goal.hyps]} />
            <Target goal={goal} change={targetChange} />
        </section>
    )
}

function stateKey(state: InteractiveGoalState, index: number): string {
    const range = state.tacticRange
    const rangePart = range
        ? `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`
        : 'no-range'
    return `${rangePart}|${state.useAfter ? 'after' : 'before'}|${state.declaration?.name ?? 'command'}|${index}`
}

function Outcome({ state, count, sharedCount }: { state: InteractiveGoalState; count: number; sharedCount: number }) {
    const headingId = React.useId()
    const tactic = tacticLabel(state)
    const goals = state.goals.goals

    return (
        <section
            className="experimental-proof-card__phase experimental-proof-card__outcome"
            aria-labelledby={headingId}
        >
            <div className="experimental-proof-card__phase-heading">
                <h3 id={headingId}>{state.useAfter ? 'After' : 'Before'}</h3>
                {count > 1 && (
                    <code title={tactic.exact} aria-label={tactic.exact}>
                        {tactic.display}
                    </code>
                )}
            </div>
            {goals.length === 0 ? (
                <p className="experimental-proof-card__complete">No goals remain.</p>
            ) : (
                goals.map((goal, goalIndex) => (
                    <Goal
                        key={goalKey(goal, goalIndex)}
                        goal={goal}
                        index={goalIndex}
                        count={goals.length}
                        sharedCount={sharedCount}
                    />
                ))
            )}
        </section>
    )
}

function cardTitle(states: InteractiveGoalState[]): React.ReactNode {
    if (states.length === 0) return 'Current expression'
    const declaration = states[0].declaration?.name
    return declaration && states.every(state => state.declaration?.name === declaration) ? (
        <code>{declaration}</code>
    ) : (
        'Current command'
    )
}

export function ProofSnapshotCard({
    states,
    expectedType,
}: {
    states: InteractiveGoalState[]
    expectedType?: InteractiveTermGoal
}) {
    const headingId = React.useId()
    const goalCount = states.reduce((total, state) => total + state.goals.goals.length, 0)
    const contexts = [
        ...(expectedType ? [expectedType.hyps] : []),
        ...states.flatMap(state => state.goals.goals.map(goal => goal.hyps)),
    ]
    const sharedCount = sharedContextLength(contexts)
    const sharedContext = contexts.length > 0 ? contexts[contexts.length - 1].slice(0, sharedCount) : []
    const singleTactic = states.length === 1 ? tacticLabel(states[0]) : undefined

    return (
        <article className="experimental-proof-card" aria-labelledby={headingId}>
            <header className="experimental-proof-card__header">
                <div className="experimental-proof-card__identity">
                    <h2 id={headingId}>{cardTitle(states)}</h2>
                    {singleTactic && (
                        <p>
                            <code title={singleTactic.exact} aria-label={singleTactic.exact}>
                                {singleTactic.display}
                            </code>
                        </p>
                    )}
                </div>
                {states.length === 1 && (
                    <span className="experimental-proof-card__count">{goalCountLabel(goalCount)}</span>
                )}
                {states.length > 1 && <span className="experimental-proof-card__count">{states.length} outcomes</span>}
            </header>

            <div className="experimental-proof-card__body">
                {sharedContext.length > 0 && (
                    <section className="experimental-proof-card__shared-context">
                        <h3 className="experimental-proof-card__visually-hidden">Shared context</h3>
                        <Context hypotheses={sharedContext} nameScopes={contexts} />
                    </section>
                )}
                {expectedType && <ExpectedType expectedType={expectedType} sharedCount={sharedCount} />}
                {states.map((state, index) => (
                    <Outcome
                        key={stateKey(state, index)}
                        state={state}
                        count={states.length}
                        sharedCount={sharedCount}
                    />
                ))}
            </div>
        </article>
    )
}
