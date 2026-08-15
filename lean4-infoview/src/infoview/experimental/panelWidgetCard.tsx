import type { InteractiveGoal, InteractiveTermGoal, UserWidgetInstance } from '@leanprover/infoview-api'
import * as React from 'react'
import type { Range } from 'vscode-languageserver-protocol'

import { PanelWidgetDisplay } from '../userWidget'
import type { DocumentPosition } from '../util'

interface PanelWidgetCardProps {
    pos: DocumentPosition
    goals: InteractiveGoal[]
    termGoal?: InteractiveTermGoal
    widget: UserWidgetInstance
}

/** Older servers may still send the former title-bar label on the wire. */
function legacyWidgetName(widget: UserWidgetInstance): string | undefined {
    const name = Reflect.get(widget, 'name')
    return typeof name === 'string' && name.length > 0 ? name : undefined
}

function PanelWidgetCard({ pos, goals, termGoal, widget }: PanelWidgetCardProps) {
    const headingId = React.useId()
    const name = legacyWidgetName(widget)
    const className = name
        ? 'experimental-panel-widget experimental-panel-widget--named'
        : 'experimental-panel-widget experimental-panel-widget--unnamed'

    return (
        <section
            className={className}
            aria-label={name ? undefined : 'Lean panel widget'}
            aria-labelledby={name ? headingId : undefined}
        >
            {name && (
                <header className="experimental-panel-widget__header">
                    <h2 id={headingId}>{name}</h2>
                </header>
            )}
            <div className="experimental-panel-widget__body">
                <PanelWidgetDisplay
                    pos={pos}
                    goals={goals}
                    termGoal={termGoal}
                    selectedLocations={[]}
                    widget={widget}
                />
            </div>
        </section>
    )
}

function rangeKey(range: Range | undefined): string {
    if (!range) return 'no-range'
    return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`
}

function keyedWidgets(widgets: UserWidgetInstance[]): { key: string; widget: UserWidgetInstance }[] {
    const occurrences = new Map<string, number>()
    return widgets.map(widget => {
        const base = `${widget.id}|${widget.javascriptHash}|${rangeKey(widget.range)}`
        const occurrence = occurrences.get(base) ?? 0
        occurrences.set(base, occurrence + 1)
        return { key: occurrence === 0 ? base : `${base}|${occurrence}`, widget }
    })
}

export interface PanelWidgetCardsProps {
    pos: DocumentPosition
    goals: InteractiveGoal[]
    termGoal?: InteractiveTermGoal
    widgets: UserWidgetInstance[]
}

export function PanelWidgetCards({ pos, goals, termGoal, widgets }: PanelWidgetCardsProps) {
    return keyedWidgets(widgets).map(({ key, widget }) => (
        <PanelWidgetCard key={key} pos={pos} goals={goals} termGoal={termGoal} widget={widget} />
    ))
}
