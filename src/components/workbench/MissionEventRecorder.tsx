'use client';

import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { eventChannels } from '@/engine/lifecycle-store';
import type { EventChannel, EventDetails, MissionEvent } from '@/engine/lifecycle-store';
import type { ScienceTarget } from '@/engine/types';
import type { Cell } from '@/engine/traverse-graph';
import scenario from '@/config/mission-scenario.json';

const categories = {
  MISSION_DELAY: 'Mission delay',
  RESOURCE_CHANGE: 'Resource loss',
  NEW_TERRAIN_HAZARD: 'New terrain hazard',
  ENVIRONMENTAL_OR_TERRAIN_CHANGE: 'Terrain or conditions changed',
  DESTINATION_ACCESSIBILITY_CHANGE: 'Destination inaccessible',
  NEW_SCIENTIFIC_DISCOVERY: 'New scientific discovery',
} satisfies Record<EventDetails['category'], string>;

export const channelLabels: Record<EventChannel, string> = {
  MANUAL_INPUT: 'Manual field input',
  AUTO_SENSOR_INPUT: 'Simulated suit sensor',
  INSTRUMENT_INTEGRATION: 'Simulated mission instrument',
};

export function eventLabel(category: EventDetails['category']) { return categories[category]; }

export function eventMeasurement(event: MissionEvent) {
  switch (event.category) {
    case 'MISSION_DELAY': return `+${event.minutes} min`;
    case 'RESOURCE_CHANGE': return `+${event.oxygen} L O₂ / +${event.energy} Wh consumed`;
    case 'NEW_TERRAIN_HAZARD': return `Radius ${event.zone.radius} cells`;
    case 'ENVIRONMENTAL_OR_TERRAIN_CHANGE': return `${Math.round(event.speedFactor * 100)}% of previous pace`;
    case 'DESTINATION_ACCESSIBILITY_CHANGE': return 'Stop removed from consideration';
    case 'NEW_SCIENTIFIC_DISCOVERY': return `${event.target.name} · ${event.target.activity.minutes} min`;
  }
}


export function scenarioPoint(cell: Cell, name = 'Custom exploration point', id = `pin-${cell.join('-')}`): ScienceTarget {
  return {
    id, name, objectiveTags: [],
    location: { gridRow: cell[0], gridCol: cell[1], originalCoordinateText: `Grid cell (${cell.join(', ')})`,
      coordinateFrame: 'LOCAL_ANALYSIS_GRID', confidence: 'USER_SELECTED', locationSource: null },
    science: {summary: 'User-selected field location.', sourceIds: [], evidence: [], limitations: ['No site-specific evidence.']},
    activity: {minutes: scenario.defaultScienceMinutes, basis: 'SCENARIO_ASSUMPTION'},
  };
}

export type EventSubmission = {details: EventDetails; channel: EventChannel; description: string};

export function MissionEventRecorder({position, selected, remaining, nextEvent, onRecord}: {
  position: Cell; selected: Cell | null; remaining: ScienceTarget[]; nextEvent: number;
  onRecord: (entry: EventSubmission) => void;
}) {
  const [category, setCategory] = useState<EventDetails['category']>('MISSION_DELAY');
  const [channel, setChannel] = useState<EventChannel>('MANUAL_INPUT');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const chosen = selected ?? position;

  return <form className="mission-event" onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount')), secondary = Number(form.get('secondary'));
    const build: Record<EventDetails['category'], () => EventDetails> = {
      MISSION_DELAY: () => ({category: 'MISSION_DELAY', minutes: amount}),
      RESOURCE_CHANGE: () => ({category: 'RESOURCE_CHANGE', oxygen: amount, energy: secondary}),
      NEW_TERRAIN_HAZARD: () => ({category: 'NEW_TERRAIN_HAZARD', zone: {cell: chosen, radius: amount}}),
      ENVIRONMENTAL_OR_TERRAIN_CHANGE: () => ({category: 'ENVIRONMENTAL_OR_TERRAIN_CHANGE', speedFactor: amount / 100}),
      DESTINATION_ACCESSIBILITY_CHANGE: () => ({category: 'DESTINATION_ACCESSIBILITY_CHANGE', targetId: String(form.get('target'))}),
      NEW_SCIENTIFIC_DISCOVERY: () => {
        const target = scenarioPoint(chosen, String(form.get('target')).trim(), `discovery-${nextEvent}`);
        return {category: 'NEW_SCIENTIFIC_DISCOVERY', target: {...target, activity: {...target.activity, minutes: amount},
          science: {...target.science, summary: description.trim() || 'Simulated geological field observation.'}}};
      },
    };
    try {
      onRecord({details: build[category](), channel, description: description.trim()});
      setDescription('');
      setError('');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to record event.');
    }
  }}>
    <label>Input channel<select value={channel} onChange={event => setChannel(event.target.value as EventChannel)}>
      {eventChannels.map(item => <option key={item} value={item}>{channelLabels[item]}</option>)}</select></label>
    <label>Event category<select value={category} onChange={event => {setCategory(event.target.value as EventDetails['category']); setError('');}}>
      {Object.entries(categories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <div key={category} className="event-fields">
      {category === 'MISSION_DELAY' && <label>Delay (min)<input name="amount" type="number" min="1" max="600" defaultValue="15" required /></label>}
      {category === 'RESOURCE_CHANGE' && <>
        <label>Extra oxygen used (L)<input name="amount" type="number" min="0" step="0.1" defaultValue="75" required /></label>
        <label>Extra energy used (Wh)<input name="secondary" type="number" min="0" step="0.1" defaultValue="0" required /></label>
      </>}
      {category === 'NEW_TERRAIN_HAZARD' && <label>Exclusion radius (cells)<input name="amount" type="number" min="0" max="20" defaultValue="1" required /></label>}
      {category === 'ENVIRONMENTAL_OR_TERRAIN_CHANGE' && <label>Remaining pace (%)<input name="amount" type="number" min="1" max="99" defaultValue="80" required /></label>}
      {category === 'DESTINATION_ACCESSIBILITY_CHANGE' && <label>Upcoming stop<select name="target" required>
        {remaining.map(stop => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select></label>}
      {category === 'NEW_SCIENTIFIC_DISCOVERY' && <>
        <label>Discovery name<input name="target" maxLength={72} required /></label>
        <label>Activity (min)<input name="amount" type="number" min="0" max="120" defaultValue="15" required /></label>
      </>}
      {(category === 'NEW_TERRAIN_HAZARD' || category === 'NEW_SCIENTIFIC_DISCOVERY') &&
        <p className="context-note">Cell ({chosen.join(', ')}). Click the map to select another location.</p>}
    </div>
    <label>Observation <input value={description} maxLength={180} onChange={event => setDescription(event.target.value)} placeholder="Optional field note" /></label>
    {error && <p role="alert" className="mission-error">{error}</p>}
    <Button label="Record event & recalculate" type="submit" variant="primary"
      isDisabled={category === 'DESTINATION_ACCESSIBILITY_CHANGE' && remaining.length === 0} />
  </form>;
}
