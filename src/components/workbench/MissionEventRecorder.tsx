'use client';

import { useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
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

const categoryOptions = Object.entries(categories).map(([value, label]) => ({ value, label }));

const defaultPrimaryAmount: Record<EventDetails['category'], number> = {
  MISSION_DELAY: 15,
  RESOURCE_CHANGE: 75,
  NEW_TERRAIN_HAZARD: 1,
  ENVIRONMENTAL_OR_TERRAIN_CHANGE: 80,
  DESTINATION_ACCESSIBILITY_CHANGE: 0,
  NEW_SCIENTIFIC_DISCOVERY: 15,
};

export const channelLabels: Record<EventChannel, string> = {
  MANUAL_INPUT: 'Manual field input',
  AUTO_SENSOR_INPUT: 'Simulated suit sensor',
  INSTRUMENT_INTEGRATION: 'Simulated mission instrument',
};

const channelOptions = eventChannels.map(value => ({ value, label: channelLabels[value] }));

export function eventLabel(category: EventDetails['category']) {
  return categories[category];
}

export function eventMeasurement(event: MissionEvent) {
  switch (event.category) {
    case 'MISSION_DELAY':
      return `+${event.minutes} min`;
    case 'RESOURCE_CHANGE':
      return `+${event.oxygen} L O₂ / +${event.energy} Wh consumed`;
    case 'NEW_TERRAIN_HAZARD':
      return `Radius ${event.zone.radius} cells`;
    case 'ENVIRONMENTAL_OR_TERRAIN_CHANGE':
      return `${Math.round(event.speedFactor * 100)}% of previous pace`;
    case 'DESTINATION_ACCESSIBILITY_CHANGE':
      return 'Stop removed from consideration';
    case 'NEW_SCIENTIFIC_DISCOVERY':
      return `${event.target.name} · ${event.target.activity.minutes} min`;
  }
}

export function scenarioPoint(cell: Cell, name = 'Custom exploration point', id = `pin-${cell.join('-')}`): ScienceTarget {
  return {
    id,
    name,
    objectiveTags: [],
    location: {
      gridRow: cell[0],
      gridCol: cell[1],
      originalCoordinateText: `Grid cell (${cell.join(', ')})`,
      coordinateFrame: 'LOCAL_ANALYSIS_GRID',
      confidence: 'USER_SELECTED',
      locationSource: null,
    },
    science: {
      summary: 'User-selected field location.',
      sourceIds: [],
      evidence: [],
      limitations: ['No site-specific evidence.'],
    },
    activity: {
      minutes: scenario.defaultScienceMinutes,
      basis: 'SCENARIO_ASSUMPTION',
    },
  };
}

export type EventSubmission = { details: EventDetails; channel: EventChannel; description: string };

export function MissionEventRecorder({ position, selected, remaining, nextEvent, onRecord, manualOnly = false, initialCategory = 'MISSION_DELAY' }: {
  position: Cell;
  selected: Cell | null;
  remaining: ScienceTarget[];
  nextEvent: number;
  manualOnly?: boolean;
  initialCategory?: EventDetails['category'];
  onRecord: (entry: EventSubmission) => void;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [channel, setChannel] = useState<EventChannel>('MANUAL_INPUT');
  const [amount, setAmount] = useState<number>(defaultPrimaryAmount[initialCategory]);
  const [secondary, setSecondary] = useState<number>(0);
  const [discoveryName, setDiscoveryName] = useState('');
  const [targetId, setTargetId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const fallback = selected ?? position;
  const selectionKey = selected ? `${selected[0]},${selected[1]}` : '';
  const [manualCoord, setManualCoord] = useState<{ key: string; row: string; col: string } | null>(null);
  const rowInput = manualCoord && manualCoord.key === selectionKey ? manualCoord.row : String(fallback[0]);
  const colInput = manualCoord && manualCoord.key === selectionKey ? manualCoord.col : String(fallback[1]);

  const parsedRow = rowInput.trim() === '' ? Number.NaN : Number(rowInput);
  const parsedCol = colInput.trim() === '' ? Number.NaN : Number(colInput);
  const chosen: Cell = Number.isInteger(parsedRow) && Number.isInteger(parsedCol)
    ? [parsedRow, parsedCol]
    : fallback;

  const activeTargetId = remaining.some(stop => stop.id === targetId)
    ? targetId
    : (remaining[0]?.id ?? '');
  const stopOptions = remaining.map(stop => ({ value: stop.id, label: stop.name }));

  const handleCategoryChange = (next: string) => {
    const typed = next as EventDetails['category'];
    setCategory(typed);
    setAmount(defaultPrimaryAmount[typed]);
    setSecondary(0);
    setError('');
  };

  return (
    <form
      className="mission-event"
      onSubmit={event => {
        event.preventDefault();
        const build: Record<EventDetails['category'], () => EventDetails> = {
          MISSION_DELAY: () => ({ category: 'MISSION_DELAY', minutes: amount }),
          RESOURCE_CHANGE: () => ({ category: 'RESOURCE_CHANGE', oxygen: amount, energy: secondary }),
          NEW_TERRAIN_HAZARD: () => ({ category: 'NEW_TERRAIN_HAZARD', zone: { cell: chosen, radius: amount } }),
          ENVIRONMENTAL_OR_TERRAIN_CHANGE: () => ({ category: 'ENVIRONMENTAL_OR_TERRAIN_CHANGE', speedFactor: amount / 100 }),
          DESTINATION_ACCESSIBILITY_CHANGE: () => ({ category: 'DESTINATION_ACCESSIBILITY_CHANGE', targetId: activeTargetId }),
          NEW_SCIENTIFIC_DISCOVERY: () => {
            if (!discoveryName.trim()) {
              throw new Error('Enter a name for the new scientific discovery.');
            }
            const target = scenarioPoint(chosen, discoveryName.trim(), `discovery-${nextEvent}`);
            return {
              category: 'NEW_SCIENTIFIC_DISCOVERY',
              target: {
                ...target,
                activity: { ...target.activity, minutes: amount },
                science: {
                  ...target.science,
                  summary: description.trim() || (manualOnly ? 'User-reported field observation.' : 'Simulated geological field observation.'),
                },
              },
            };
          },
        };
        try {
          if (manualOnly && (category === 'NEW_TERRAIN_HAZARD' || category === 'NEW_SCIENTIFIC_DISCOVERY') &&
              (!Number.isInteger(parsedRow) || !Number.isInteger(parsedCol))) {
            throw new Error('Enter a whole row and column within the modeled terrain.');
          }
          onRecord({ details: build[category](), channel, description: description.trim() });
          setDescription('');
          setDiscoveryName('');
          setError('');
        } catch (issue) {
          setError(issue instanceof Error ? issue.message : 'Unable to record event.');
        }
      }}
    >
      <VStack gap={2}>
        {!manualOnly && <Selector
          label="Input channel"
          size="sm"
          width="100%"
          options={channelOptions}
          value={channel}
          onChange={val => setChannel(val as EventChannel)}
        />}
        <Selector
          label="Event category"
          size="sm"
          width="100%"
          options={categoryOptions}
          value={category}
          onChange={handleCategoryChange}
        />
        <div key={category} className="event-fields">
          {category === 'MISSION_DELAY' && (
            <NumberInput
              label="Delay (min)"
              size="sm"
              width="100%"
              min={1}
              max={600}
              step={1}
              isIntegerOnly
              hasNumberSteppers
              value={amount}
              onChange={setAmount}
              isRequired
            />
          )}
          {category === 'RESOURCE_CHANGE' && (
            <VStack gap={2}>
              <NumberInput
                label="Extra oxygen used (L)"
                size="sm"
                width="100%"
                min={0}
                step={0.5}
                hasNumberSteppers
                value={amount}
                onChange={setAmount}
                isRequired
              />
              <NumberInput
                label="Extra energy used (Wh)"
                size="sm"
                width="100%"
                min={0}
                step={1}
                hasNumberSteppers
                value={secondary}
                onChange={setSecondary}
                isRequired
              />
            </VStack>
          )}
          {category === 'NEW_TERRAIN_HAZARD' && (
            <NumberInput
              label="Exclusion radius (cells)"
              size="sm"
              width="100%"
              min={0}
              max={20}
              step={1}
              isIntegerOnly
              hasNumberSteppers
              value={amount}
              onChange={setAmount}
              isRequired
            />
          )}
          {category === 'ENVIRONMENTAL_OR_TERRAIN_CHANGE' && (
            <NumberInput
              label="Remaining pace (%)"
              size="sm"
              width="100%"
              min={1}
              max={99}
              step={5}
              isIntegerOnly
              hasNumberSteppers
              value={amount}
              onChange={setAmount}
              isRequired
            />
          )}
          {category === 'DESTINATION_ACCESSIBILITY_CHANGE' && (
            <Selector
              label="Upcoming stop"
              size="sm"
              width="100%"
              options={stopOptions}
              value={activeTargetId}
              onChange={setTargetId}
              isDisabled={remaining.length === 0}
              isRequired
            />
          )}
          {category === 'NEW_SCIENTIFIC_DISCOVERY' && (
            <VStack gap={2}>
              <TextInput
                label="Discovery name"
                size="sm"
                width="100%"
                value={discoveryName}
                onChange={val => setDiscoveryName(val.slice(0, 72))}
                isRequired
              />
              <NumberInput
                label="Activity (min)"
                size="sm"
                width="100%"
                min={0}
                max={120}
                step={1}
                isIntegerOnly
                hasNumberSteppers
                value={amount}
                onChange={setAmount}
                isRequired
              />
            </VStack>
          )}
          {(category === 'NEW_TERRAIN_HAZARD' || category === 'NEW_SCIENTIFIC_DISCOVERY') && (
            <div className="cc-event-coords">
              <HStack gap={2}>
                <TextInput
                  label="Event row Y"
                  size="sm"
                  inputMode="numeric"
                  width="50%"
                  value={rowInput}
                  onChange={val => setManualCoord({ key: selectionKey, row: val, col: colInput })}
                  isRequired
                />
                <TextInput
                  label="Event column X"
                  size="sm"
                  inputMode="numeric"
                  width="50%"
                  value={colInput}
                  onChange={val => setManualCoord({ key: selectionKey, row: rowInput, col: val })}
                  isRequired
                />
              </HStack>
              <Text type="supporting">
                Target cell ({chosen.join(', ')}). Enter coordinates or click the map.
              </Text>
            </div>
          )}
        </div>
        <TextInput
          label="Observation"
          size="sm"
          width="100%"
          value={description}
          onChange={val => setDescription(val.slice(0, 180))}
          placeholder="Optional field note"
        />
        {error && <Banner status="error" role="alert" title={error} />}
        <Button
          label="Record event & recalculate"
          type="submit"
          variant="primary"
          isDisabled={category === 'DESTINATION_ACCESSIBILITY_CHANGE' && remaining.length === 0}
        />
      </VStack>
    </form>
  );
}
