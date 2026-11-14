'use client';

import { useSyncExternalStore } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Divider } from '@astryxdesign/core/Divider';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Popover } from '@astryxdesign/core/Popover';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Slider } from '@astryxdesign/core/Slider';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { OPTIONS, PARAMS, PRESETS, SEEDS } from '@/theme/presets';
import {
  getModePreferenceServerSnapshot,
  getModePreferenceSnapshot,
  setModePreference,
  subscribeMode,
} from '@/theme/theme-store';
import type { ModePreference } from '@/theme/theme-store';
import {
  getOptionSnapshot,
  getParamSnapshot,
  getPresetSnapshot,
  getRadiusSnapshot,
  getSeedSnapshot,
  hasOverridesSnapshot,
  resetTokens,
  setOption,
  setParam,
  setPreset,
  setRadius,
  setSeed,
  subscribeTokens,
} from '@/theme/token-store';

function SeedColorRow({ name, label }: { name: string; label: string }) {
  const value = useSyncExternalStore(subscribeTokens, () => getSeedSnapshot(name), () => '#10584e');
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#10584e';
  const id = name.replace('--seed-', '');

  return (
    <HStack vAlign="center" hAlign="between" gap={3}>
      <Text size="sm" weight="medium">{label}</Text>
      <HStack vAlign="center" gap={2}>
        <code className="theme-token-code" data-testid={`theme-seed-${id}-value`}>
          {safeHex}
        </code>
        <input
          type="color"
          className="theme-seed-input"
          aria-label={`${label} color`}
          data-testid={`theme-seed-${id}`}
          value={safeHex}
          onChange={e => setSeed(name, e.target.value)}
        />
      </HStack>
    </HStack>
  );
}

function ParamSliderRow({ name, label, min, max, step }: { name: string; label: string; min: number; max: number; step: number }) {
  const value = useSyncExternalStore(subscribeTokens, () => getParamSnapshot(name), () => 1);
  return (
    <Slider
      label={label}
      min={min}
      max={max}
      step={step}
      value={Number.isFinite(value) ? value : 1}
      valueDisplay="text"
      formatValue={v => `${v.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}×`}
      onChange={(val: number) => setParam(name, val)}
    />
  );
}

function TypographyOptionRow() {
  const fontOpt = OPTIONS[0];
  const current = useSyncExternalStore(subscribeTokens, () => getOptionSnapshot(fontOpt.attr), () => '');
  return (
    <VStack gap={1.5}>
      <Text size="sm" weight="medium">{fontOpt.label}</Text>
      <SegmentedControl
        label={fontOpt.label}
        size="sm"
        layout="fill"
        value={current}
        onChange={val => setOption(fontOpt.attr, val)}
      >
        {fontOpt.values.map(v => (
          <SegmentedControlItem key={v.id || 'default'} value={v.id} label={v.label} />
        ))}
      </SegmentedControl>
    </VStack>
  );
}

function ThemeControlBody() {
  const modePref = useSyncExternalStore(
    subscribeMode,
    getModePreferenceSnapshot,
    getModePreferenceServerSnapshot,
  );
  const activePreset = useSyncExternalStore(subscribeTokens, getPresetSnapshot, () => PRESETS[0].id);
  const radius = useSyncExternalStore(subscribeTokens, getRadiusSnapshot, () => 6);
  const dirty = useSyncExternalStore(subscribeTokens, hasOverridesSnapshot, () => false);

  return (
    <VStack gap={3} className="theme-popup-body">
      <HStack hAlign="between" vAlign="start" gap={2}>
        <VStack gap={0.5} className="theme-popup-title">
          <Heading level={3}>Appearance &amp; Theme</Heading>
          <Text type="supporting">
            Single-source tokens driving Astryx &amp; map panels
          </Text>
        </VStack>
        <div className="theme-popup-reset">
          <Button
            label="Reset"
            variant="ghost"
            size="sm"
            isDisabled={!dirty && modePref === 'light'}
            onClick={() => {
              resetTokens();
              setModePreference('light');
            }}
          />
        </div>
      </HStack>

      <VStack gap={1.5}>
        <Text size="sm" weight="medium">Color mode</Text>
        <SegmentedControl
          label="Color mode"
          size="sm"
          layout="fill"
          value={modePref}
          onChange={val => setModePreference(val as ModePreference)}
        >
          <SegmentedControlItem value="light" label="Light" />
          <SegmentedControlItem value="dark" label="Dark" />
          <SegmentedControlItem value="system" label="System" />
        </SegmentedControl>
      </VStack>

      <Divider />

      <VStack gap={2}>
        <HStack hAlign="between" vAlign="center">
          <Text size="sm" weight="medium">Presets</Text>
          <Badge variant="neutral" label="Jezero default" />
        </HStack>
        <div className="theme-preset-grid" role="group" aria-label="Theme presets">
          {PRESETS.map(p => {
            const selected = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className="theme-preset-btn"
                aria-pressed={selected}
                onClick={() => setPreset(p.id)}
              >
                <span className="theme-preset-head">
                  <span
                    className="theme-preset-swatch"
                    data-preset-swatch={p.id}
                    aria-hidden="true"
                  />
                  <strong>{p.label}</strong>
                  {p.isDefault && <span className="theme-preset-tag">Default</span>}
                </span>
                <small>{p.summary}</small>
              </button>
            );
          })}
        </div>
      </VStack>

      <Divider />

      <Collapsible defaultIsOpen={false} trigger={<Text size="sm" weight="medium">Seeds, radius &amp; layout density</Text>}>
        <VStack gap={3} paddingBlockStart={2}>
          <VStack gap={2}>
            {SEEDS.map(s => (
              <SeedColorRow key={s.name} {...s} />
            ))}
          </VStack>
          <Divider />
          <Slider
            label="Corner radius"
            min={0}
            max={16}
            step={1}
            value={Math.round(Number.isFinite(radius) ? radius : 6)}
            valueDisplay="text"
            formatValue={v => `${Math.round(v)}px`}
            onChange={(val: number) => setRadius(val)}
          />
          {PARAMS.map(p => (
            <ParamSliderRow key={p.name} {...p} />
          ))}
          <TypographyOptionRow />
        </VStack>
      </Collapsible>
    </VStack>
  );
}

export function ThemeControlPopup() {
  return (
    <Popover
      label="Theme and appearance settings"
      presentation="adaptive"
      placement="below"
      alignment="end"
      width={368}
      padding={4}
      content={<ThemeControlBody />}
    >
      <Button
        label="Theme"
        variant="secondary"
        size="sm"
        icon={<Icon icon="wrench" />}
      />
    </Popover>
  );
}
