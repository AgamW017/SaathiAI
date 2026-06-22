'use client';

import React, { useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DistrictDatum {
  district: string;
  state: string | null;
  count: number;
  placed: number;
}

interface IndiaLearnerMapProps {
  data: DistrictDatum[];
  officerDistrict: string | null;
}

interface HoveredInfo {
  name: string;
  state: string | null;
  count: number;
  placed: number;
  x: number;
  y: number;
}

// ─── Fill scale ───────────────────────────────────────────────────────────────

function getFill(count: number | undefined, isOfficer: boolean): string {
  if (isOfficer) return '#fa5d00';
  if (!count || count === 0) return '#eef1f0';
  if (count <= 2) return '#cfe3df';
  if (count <= 5) return '#8fc4ba';
  if (count <= 10) return '#4f9d90';
  return '#1f7468';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IndiaLearnerMap({ data, officerDistrict }: IndiaLearnerMapProps) {
  const [hovered, setHovered] = useState<HoveredInfo | null>(null);

  const byDistrict = React.useMemo(() => {
    const map = new Map<string, { count: number; placed: number; state: string | null }>();
    for (const d of data) {
      map.set(d.district.trim().toLowerCase(), {
        count: d.count,
        placed: d.placed,
        state: d.state,
      });
    }
    return map;
  }, [data]);

  const officerKey = (officerDistrict ?? '').trim().toLowerCase();

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Map */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [82.8, 22.5], scale: 1000 }}
        width={620}
        height={680}
        style={{ width: '100%', height: 'auto', background: 'transparent' }}
      >
        <Geographies geography="/india-states.topo.json">
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => {
              const key = (geo.properties.district ?? '').trim().toLowerCase();
              const d = byDistrict.get(key);
              const isOfficer = !!officerKey && key === officerKey;
              const fill = getFill(d?.count, isOfficer);
              const stroke = isOfficer ? '#b33f00' : '#ffffff';
              const strokeWidth = isOfficer ? 1.2 : 0.4;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', cursor: 'pointer', opacity: 0.85 },
                    pressed: { outline: 'none' },
                  }}
                  onMouseEnter={(e: React.MouseEvent<SVGPathElement>) => {
                    const districtName = geo.properties.district ?? key;
                    const stateName = geo.properties.st_nm ?? d?.state ?? null;
                    setHovered({
                      name: districtName,
                      state: stateName,
                      count: d?.count ?? 0,
                      placed: d?.placed ?? 0,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Tooltip */}
      {hovered && (
        <div
          style={{
            position: 'fixed',
            left: hovered.x + 14,
            top: hovered.y - 10,
            background: '#fff',
            borderRadius: '10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
            border: '1px solid rgba(0,0,0,0.07)',
            padding: '10px 14px',
            pointerEvents: 'none',
            zIndex: 9999,
            minWidth: '140px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f161e', marginBottom: '2px' }}>
            {hovered.name}
          </div>
          {hovered.state && (
            <div style={{ fontSize: '11px', color: '#a09d99', marginBottom: '6px' }}>
              {hovered.state}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#333942' }}>
            <span style={{ fontWeight: 600 }}>{hovered.count}</span> learners
          </div>
          <div style={{ fontSize: '12px', color: '#333942' }}>
            <span style={{ fontWeight: 600 }}>{hovered.placed}</span> placed
          </div>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          marginTop: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        {[
          { color: '#eef1f0', label: 'No learners' },
          { color: '#cfe3df', label: '1–2' },
          { color: '#8fc4ba', label: '3–5' },
          { color: '#4f9d90', label: '6–10' },
          { color: '#1f7468', label: '11+' },
          { color: '#fa5d00', label: 'Your district', border: '#b33f00' },
        ].map(({ color, label, border }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '3px',
                background: color,
                border: `1.5px solid ${border ?? 'rgba(0,0,0,0.12)'}`,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '11px', color: '#615f5c', whiteSpace: 'nowrap' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
