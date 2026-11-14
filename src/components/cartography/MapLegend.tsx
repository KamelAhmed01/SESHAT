'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import type { FieldBundle } from '@/data/loader';

export interface MapLegendProps {
  bundle: FieldBundle | null;
  showOptical?: boolean;
  showElevation?: boolean;
  showGeology?: boolean;
  showThermal?: boolean;
  isMissionMap?: boolean;
  hasPlannedRoute?: boolean;
  hasPreviousRoute?: boolean;
  hasHazards?: boolean;
}

const DEFAULT_GEOLOGIC_UNITS = [
  { index: 1, symbol: 'Crater floor fractured 1', name: 'Crater floor fractured 1', color: '#10b981', desc: 'Olivine-rich crater floor' },
  { index: 2, symbol: 'Crater floor fractured 2', name: 'Crater floor fractured 2', color: '#f3a833', desc: 'Pyroxene-bearing floor & ridges' },
  { index: 3, symbol: 'Crater floor fractured rough', name: 'Crater floor fractured rough', color: '#38bdf8', desc: 'Rough boulder-strewn floor' },
  { index: 4, symbol: 'Delta blocky', name: 'Delta blocky', color: '#f472b6', desc: 'Blocky delta front deposits' },
  { index: 5, symbol: 'Delta thinly layered', name: 'Delta thinly layered', color: '#a855f7', desc: 'Clay-rich layered bottomsets' },
  { index: 6, symbol: 'Delta truncated curvilinear layered', name: 'Delta truncated curvilinear layered', color: '#facc15', desc: 'Channel & bar topsets' },
];

export function MapLegend({
  bundle,
  showElevation = false,
  showGeology = false,
  showThermal = false,
  hasPlannedRoute = false,
  hasPreviousRoute = false,
  hasHazards = false,
}: MapLegendProps) {
  const [isOpen, setIsOpen] = useState(showElevation || showGeology || showThermal);
  const prevElevation = useRef(showElevation);
  const prevGeology = useRef(showGeology);
  const prevThermal = useRef(showThermal);

  useEffect(() => {
    if (
      (!prevElevation.current && showElevation) ||
      (!prevGeology.current && showGeology) ||
      (!prevThermal.current && showThermal)
    ) {
      setIsOpen(true);
    }
    prevElevation.current = showElevation;
    prevGeology.current = showGeology;
    prevThermal.current = showThermal;
  }, [showElevation, showGeology, showThermal]);

  const { minElev, maxElev } = useMemo(() => {
    if (!bundle) return { minElev: -2586, maxElev: -2419 };
    const z = bundle.elevationMeters;
    const mask = bundle.mask;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const len = Math.min(bundle.manifest.width * bundle.manifest.height, z.length);
    for (let i = 0; i < len; i++) {
      if (mask[i] === 1 && Number.isFinite(z[i])) {
        if (z[i] < minZ) minZ = z[i];
        if (z[i] > maxZ) maxZ = z[i];
      }
    }
    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
      return { minElev: -2586, maxElev: -2419 };
    }
    return { minElev: Math.round(minZ), maxElev: Math.round(maxZ) };
  }, [bundle]);

  const units = useMemo(() => {
    const loadedUnits = bundle?.contextData?.geologicUnits?.units;
    if (loadedUnits && loadedUnits.length > 0) {
      return loadedUnits.map(u => {
        const fallback = DEFAULT_GEOLOGIC_UNITS.find(d => d.index === u.index);
        return {
          ...u,
          desc: fallback?.desc ?? 'Bedrock mapping unit',
        };
      });
    }
    return DEFAULT_GEOLOGIC_UNITS;
  }, [bundle]);

  const tiMin = bundle?.manifest.contextLayers?.thermalInertia?.minValue ?? 142;
  const tiMax = bundle?.manifest.contextLayers?.thermalInertia?.maxValue ?? 304;

  if (!isOpen) {
    return (
      <div className="cc-map-legend-docked">
        <button
          type="button"
          className="cc-map-legend-toggle"
          onClick={() => setIsOpen(true)}
          aria-expanded={false}
          aria-label="Open map layer legend and elevation guide"
        >
          <span className="cc-legend-toggle-icon" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="2" width="12" height="12" rx="2" />
              <line x1="2" y1="7" x2="14" y2="7" />
              <line x1="7" y1="7" x2="7" y2="14" />
            </svg>
          </span>
          <span className="cc-legend-toggle-text">Legend</span>
          {showElevation && <span className="cc-legend-chip cc-chip-elev">Elevation</span>}
          {showGeology && <span className="cc-legend-chip cc-chip-geo">Geology</span>}
          {showThermal && <span className="cc-legend-chip cc-chip-ti">Thermal</span>}
        </button>
      </div>
    );
  }

  return (
    <aside className="cc-map-legend-panel" role="region" aria-label="Map layer legend and elevation guide">
      <div className="cc-legend-head">
        <div className="cc-legend-head-title">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="2" y="2" width="12" height="12" rx="2" />
            <line x1="2" y1="7" x2="14" y2="7" />
            <line x1="7" y1="7" x2="7" y2="14" />
          </svg>
          <strong>Map Layers &amp; Elevation</strong>
          <span className="cc-legend-source-pill">NASA Data</span>
        </div>
        <IconButton
          label="Close map layer legend"
          icon={<Icon icon="close" />}
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
        />
      </div>

      {(showGeology || showThermal) && !showElevation && (
        <div className="cc-legend-callout" role="note">
          <div className="cc-callout-header">
            <span className="cc-callout-badge">Elevation Note</span>
          </div>
          <p className="cc-callout-body">
            Active colors depict{' '}
            <strong>
              {showGeology && showThermal ? 'geologic units and thermal inertia' : showGeology ? 'bedrock geologic units' : 'thermal inertia (heat retention)'}
            </strong>
            , <em>not surface elevation</em>. Topographic height is represented by contour lines and shaded relief below (or activate the <strong>Elevation</strong> heatmap layer).
          </p>
        </div>
      )}

      {(showGeology || showThermal) && showElevation && (
        <div className="cc-legend-callout" role="note">
          <div className="cc-callout-header">
            <span className="cc-callout-badge">Layer Comparison</span>
          </div>
          <p className="cc-callout-body">
            <strong>Elevation heatmap</strong> is active (Blue = low crater floor; Red = high delta rim). The thematic Geology/Thermal overlays indicate bedrock lithology and surface heat retention.
          </p>
        </div>
      )}

      {showElevation && (
        <section className="cc-legend-section" aria-label="Elevation heatmap">
          <div className="cc-section-header">
            <span className="cc-section-name">Elevation Heatmap · Hypsometry</span>
            <span className="cc-section-source">USGS MRO CTX 20 m DTM · True height</span>
          </div>
          <div className="cc-elev-bar-container">
            <div className="cc-elevation-gradient" aria-hidden="true" />
            <div className="cc-elev-scale-labels">
              <div className="cc-elev-label cc-elev-label-low">
                <strong>{minElev.toLocaleString()} m</strong>
                <span>Lowest · Crater floor (Blue)</span>
              </div>
              <div className="cc-elev-label cc-elev-label-mid">
                <strong>{Math.round((minElev + maxElev) / 2).toLocaleString()} m</strong>
                <span>Mid · Delta slope (Green)</span>
              </div>
              <div className="cc-elev-label cc-elev-label-high">
                <strong>{maxElev.toLocaleString()} m</strong>
                <span>Highest · Delta rim (Red)</span>
              </div>
            </div>
          </div>
          <p className="cc-section-caption">
            Blue colors represent low crater floor terrain; red colors represent high delta crests and rim scarps.
          </p>
        </section>
      )}

      {showGeology && (
        <section className="cc-legend-section" aria-label="Geologic bedrock units">
          <div className="cc-section-header">
            <span className="cc-section-name">Geologic Units · Bedrock Lithology</span>
            <span className="cc-section-source">Stack et al. (2020) · Not elevation</span>
          </div>
          <ul className="cc-geology-list">
            {units.map(unit => (
              <li key={unit.index} className="cc-geology-row">
                <span
                  className="cc-unit-swatch"
                  style={{ backgroundColor: unit.color }}
                  aria-hidden="true"
                />
                <div className="cc-unit-meta">
                  <span className="cc-unit-title">{unit.name}</span>
                  <span className="cc-unit-desc">{unit.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showThermal && (
        <section className="cc-legend-section" aria-label="Thermal inertia">
          <div className="cc-section-header">
            <span className="cc-section-name">Thermal Inertia (TIU)</span>
            <span className="cc-section-source">Edwards &amp; Buz (2021) · J m⁻² K⁻¹ s⁻¹/²</span>
          </div>
          <div className="cc-ti-bar-container">
            <div className="cc-ti-gradient-bar" aria-hidden="true" />
            <div className="cc-ti-scale-labels">
              <div className="cc-ti-label cc-ti-label-low">
                <strong>{Math.round(tiMin)}</strong>
                <span>Low (Indigo) · Loose dust &amp; fine sand</span>
              </div>
              <div className="cc-ti-label cc-ti-label-mid">
                <strong>~220</strong>
                <span>Medium (Teal) · Regolith &amp; pebbles</span>
              </div>
              <div className="cc-ti-label cc-ti-label-high">
                <strong>{Math.round(tiMax)}</strong>
                <span>High (Amber) · Dense bedrock &amp; pavement</span>
              </div>
            </div>
          </div>
          <p className="cc-section-caption">
            Higher values retain daytime heat longer into the Martian night. Cool/warm colors do not reflect elevation.
          </p>
        </section>
      )}

      <section className="cc-legend-section" aria-label="Topographic elevation">
        <div className="cc-section-header">
          <span className="cc-section-name">Topography &amp; Elevation</span>
          <span className="cc-section-source">USGS MRO CTX 20 m DTM (Mars AEQD)</span>
        </div>
        <div className="cc-elevation-guide">
          <div className="cc-elev-row">
            <span className="cc-elev-line cc-line-major-contour" aria-hidden="true" />
            <span><strong>Major contours:</strong> 20 m interval (gold)</span>
          </div>
          <div className="cc-elev-row">
            <span className="cc-elev-line cc-line-minor-contour" aria-hidden="true" />
            <span><strong>Minor contours:</strong> 5 m interval (cream)</span>
          </div>
          <div className="cc-elev-row">
            <span className="cc-elev-hillshade" aria-hidden="true">◐</span>
            <span><strong>Shaded relief:</strong> DEM surface aspect &amp; slope illumination</span>
          </div>
        </div>

        <div className="cc-relief-box">
          <div className="cc-relief-stat">
            <span className="cc-relief-tag">Crater Floor (Low)</span>
            <strong className="cc-relief-number">{minElev.toLocaleString()} m</strong>
          </div>
          <span className="cc-relief-arrow" aria-hidden="true">→ {Math.abs(maxElev - minElev)} m total relief →</span>
          <div className="cc-relief-stat">
            <span className="cc-relief-tag">Delta Rim (High)</span>
            <strong className="cc-relief-number">{maxElev.toLocaleString()} m</strong>
          </div>
        </div>
        <p className="cc-inspect-tip">
          Click any point on the map to inspect its exact elevation in meters.
        </p>
      </section>

      <section className="cc-legend-section cc-legend-features" aria-label="Map and route symbols">
        <div className="cc-section-header">
          <span className="cc-section-name">Traverse &amp; Boundaries</span>
        </div>
        <div className="cc-features-list">
          <div className="cc-feature-item">
            <span className="cc-feat-line cc-feat-boundary" aria-hidden="true" />
            <span>Modeled area boundary (20 m AEQD)</span>
          </div>
          {hasPlannedRoute && (
            <div className="cc-feature-item">
              <span className="cc-feat-line cc-feat-route" aria-hidden="true" />
              <span>Traverse route</span>
            </div>
          )}
          {hasPreviousRoute && (
            <div className="cc-feature-item">
              <span className="cc-feat-line cc-feat-previous" aria-hidden="true" />
              <span>Previous / return baseline</span>
            </div>
          )}
          <div className="cc-feature-item">
            <span className="cc-feat-marker cc-marker-base" aria-hidden="true" />
            <span>Scenario landing site</span>
          </div>
          <div className="cc-feature-item">
            <span className="cc-feat-marker cc-marker-target" aria-hidden="true" />
            <span>Science target pin</span>
          </div>
          {hasHazards && (
            <div className="cc-feature-item">
              <span className="cc-feat-marker cc-marker-hazard" aria-hidden="true" />
              <span>Hazard zone (keep-out radius)</span>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
