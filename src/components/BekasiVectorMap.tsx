import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Maximize2, Minus, Plus, Tag } from 'lucide-react';
import {
  BEKASI_GEOJSON,
  KECAMATAN_FEATURES,
  KECAMATAN_META_BY_ID,
  KECAMATAN_META_LIST,
} from '../data/bekasiData';
import type {
  ChoroplethFilter,
  DemographicMetric,
  DistrictStatus,
  KecamatanFeature,
  Language,
  QuizMode,
  ThemePreset,
} from '../types/quiz';
import { formatKepadatan, formatLuas, formatPenduduk } from '../utils/format';
import { getMetricLabel, UI_COPY } from '../utils/i18n';
import { THEME_CONFIG } from '../utils/theme';

export interface DuelMapHighlight {
  idA: string;
  idB: string;
  winnerId: string;
  answered: boolean;
}

interface BekasiVectorMapProps {
  mode: QuizMode;
  statuses: Record<string, DistrictStatus>;
  targetId: string | null;
  wrongFlashId: string | null;
  hintPulseId: string | null;
  selectedExploreId: string | null;
  hoveredId: string | null;
  onHoverDistrict: (id: string | null) => void;
  onSelectDistrict: (feature: KecamatanFeature) => void;
  focusRequest?: { id: string; nonce: number } | null;
  choroplethFilter?: ChoroplethFilter;
  duelHighlight?: DuelMapHighlight | null;
  compact?: boolean;
  lang?: Language;
  theme?: ThemePreset;
}

const CHOROPLETH_META: Record<
  DemographicMetric,
  {
    interpolator: (t: number) => string;
    gradientCss: string;
    formatValue: (v: number, lang: Language) => string;
  }
> = {
  penduduk: {
    interpolator: (t) => d3.interpolateBlues(0.14 + t * 0.78),
    gradientCss: 'linear-gradient(to right, #deebf7, #6baed6, #08519c)',
    formatValue: formatPenduduk,
  },
  luas: {
    interpolator: (t) => d3.interpolateGreens(0.14 + t * 0.78),
    gradientCss: 'linear-gradient(to right, #e5f5e0, #74c476, #006d2c)',
    formatValue: formatLuas,
  },
  kepadatan: {
    interpolator: (t) => d3.interpolateYlOrRd(0.1 + t * 0.82),
    gradientCss: 'linear-gradient(to right, #ffeda0, #fd8d3c, #bd0026)',
    formatValue: formatKepadatan,
  },
};

export const BekasiVectorMap: React.FC<BekasiVectorMapProps> = ({
  mode,
  statuses,
  targetId,
  wrongFlashId,
  hintPulseId,
  selectedExploreId,
  hoveredId,
  onHoverDistrict,
  onSelectDistrict,
  focusRequest,
  choroplethFilter = 'none',
  duelHighlight = null,
  compact = false,
  lang = 'id',
  theme = 'light',
}) => {
  const copy = UI_COPY[lang];
  const tokens = THEME_CONFIG[theme];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomLayerRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [zoomK, setZoomK] = useState<number>(1);
  const [showSolvedLabels, setShowSolvedLabels] = useState<boolean>(() => !compact);
  const [hasInteractedZoom, setHasInteractedZoom] = useState<boolean>(false);

  // Sync label default if compact changes
  useEffect(() => {
    setShowSolvedLabels(!compact);
  }, [compact]);

  // Measure container cleanly for responsive auto fit-bounds
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const silhouetteFeature = useMemo(() => {
    if (mode !== 'silhouette' || !targetId) return null;
    return KECAMATAN_FEATURES.find((f) => f.properties.id === targetId) || null;
  }, [mode, targetId]);

  // Compute Choropleth min/max & per-district fills when active in explore mode
  const choroplethData = useMemo(() => {
    if (mode !== 'explore' || choroplethFilter === 'none') return null;

    const metric = choroplethFilter;
    const config = CHOROPLETH_META[metric];
    const values = KECAMATAN_META_LIST.map((m) => m[metric]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    const colors: Record<string, string> = {};
    for (const item of KECAMATAN_META_LIST) {
      const t = Math.max(0, Math.min(1, (item[metric] - min) / span));
      colors[item.id] = config.interpolator(t);
    }

    return {
      metric,
      label: getMetricLabel(metric, lang),
      gradientCss: config.gradientCss,
      minLabel: config.formatValue(min, lang),
      maxLabel: config.formatValue(max, lang),
      colors,
    };
  }, [mode, choroplethFilter, lang]);

  // Compute D3 Mercator projection automatically fit to center of viewport
  const { paths, centroids } = useMemo(() => {
    const { width, height } = dimensions;
    if (width <= 0 || height <= 0) {
      return {
        paths: new Map<string, string>(),
        centroids: new Map<string, [number, number]>(),
      };
    }

    const isSilhouette = mode === 'silhouette' && silhouetteFeature !== null;
    const padX = isSilhouette
      ? Math.max(44, Math.round(width * 0.16))
      : compact
      ? Math.max(12, Math.round(width * 0.04))
      : Math.max(20, Math.round(width * 0.055));
    const padY = isSilhouette
      ? Math.max(44, Math.round(height * 0.16))
      : compact
      ? Math.max(10, Math.round(height * 0.06))
      : Math.max(20, Math.round(height * 0.055));

    const fitTarget = isSilhouette ? silhouetteFeature : BEKASI_GEOJSON;

    const projection = d3
      .geoMercator()
      .fitExtent(
        [
          [padX, padY],
          [width - padX, height - padY],
        ],
        fitTarget
      );

    const pathGenerator = d3.geoPath().projection(projection);

    const nextPaths = new Map<string, string>();
    const nextCentroids = new Map<string, [number, number]>();

    const featuresToRender = isSilhouette ? [silhouetteFeature] : KECAMATAN_FEATURES;
    for (const feature of featuresToRender) {
      const id = feature.properties.id;
      const d = pathGenerator(feature) || '';
      const c = pathGenerator.centroid(feature);
      nextPaths.set(id, d);
      if (Number.isFinite(c[0]) && Number.isFinite(c[1])) {
        nextCentroids.set(id, [c[0], c[1]]);
      }
    }

    return { paths: nextPaths, centroids: nextCentroids };
  }, [dimensions, mode, silhouetteFeature, compact]);

  // Configure D3 pinch-to-zoom and pan
  useEffect(() => {
    const svgEl = svgRef.current;
    const zoomLayerEl = zoomLayerRef.current;
    const { width, height } = dimensions;
    if (!svgEl || !zoomLayerEl || width <= 0 || height <= 0) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .clickDistance(10)
      .translateExtent([
        [-width * 0.25, -height * 0.25],
        [width * 1.25, height * 1.25],
      ])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        d3.select(zoomLayerEl).attr('transform', event.transform.toString());
        setZoomK(event.transform.k);
        if (event.sourceEvent) {
          setHasInteractedZoom(true);
        }
      });

    zoomBehaviorRef.current = zoom;
    const svgSelection = d3.select(svgEl);
    svgSelection.call(zoom);
    svgSelection.call(zoom.transform, d3.zoomIdentity);

    return () => {
      svgSelection.on('.zoom', null);
    };
  }, [dimensions]);

  // Reset zoom/pan cleanly when mode or silhouette target changes
  useEffect(() => {
    const svgEl = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svgEl || !zoom) return;
    d3.select(svgEl).call(zoom.transform, d3.zoomIdentity);
  }, [mode, targetId]);

  const handleResetFit = useCallback(() => {
    const svgEl = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svgEl || !zoom) return;

    d3.select(svgEl)
      .transition()
      .duration(260)
      .ease(d3.easeCubicOut)
      .call(zoom.transform, d3.zoomIdentity);
  }, []);

  const handleZoomStep = useCallback((factor: number) => {
    const svgEl = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svgEl || !zoom) return;

    setHasInteractedZoom(true);
    d3.select(svgEl)
      .transition()
      .duration(220)
      .ease(d3.easeCubicOut)
      .call(zoom.scaleBy, factor);
  }, []);

  // Optional programmatic focus on a specific district
  useEffect(() => {
    if (!focusRequest) return;
    const centroid = centroids.get(focusRequest.id);
    const svgEl = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    const { width, height } = dimensions;
    if (!centroid || !svgEl || !zoom || width <= 0 || height <= 0) return;

    const targetScale = 2.6;
    const tx = width / 2 - centroid[0] * targetScale;
    const ty = height / 2 - centroid[1] * targetScale;
    const transform = d3.zoomIdentity.translate(tx, ty).scale(targetScale);

    d3.select(svgEl)
      .transition()
      .duration(320)
      .ease(d3.easeCubicOut)
      .call(zoom.transform, transform);
  }, [focusRequest, centroids, dimensions]);

  const getPolygonStyle = (featureId: string) => {
    const isWrongFlash = wrongFlashId === featureId;
    const isHovered = hoveredId === featureId;
    const status = statuses[featureId] || 'unanswered';
    const isChoiceTarget = mode === 'choice' && targetId === featureId;
    const isExploreSelected = mode === 'explore' && selectedExploreId === featureId;

    if (isWrongFlash) {
      return {
        fill: '#EF4444',
        stroke: tokens.isDark ? '#FECACA' : '#991B1B',
        strokeWidth: 1.8,
      };
    }

    // Duel mode: 2 contrasting highlighted districts (A = Blue, B = Orange)
    if (mode === 'duel' && duelHighlight) {
      if (duelHighlight.idA === featureId) {
        const isWinnerHighlight =
          duelHighlight.answered && duelHighlight.winnerId === featureId;
        return {
          fill: tokens.mapDuelBlueFill,
          stroke: isWinnerHighlight ? tokens.mapDuelWinnerStroke : tokens.mapDuelBlueStroke,
          strokeWidth: isWinnerHighlight ? 2.4 : 2.0,
        };
      }
      if (duelHighlight.idB === featureId) {
        const isWinnerHighlight =
          duelHighlight.answered && duelHighlight.winnerId === featureId;
        return {
          fill: tokens.mapDuelOrangeFill,
          stroke: isWinnerHighlight ? tokens.mapDuelWinnerStroke : tokens.mapDuelOrangeStroke,
          strokeWidth: isWinnerHighlight ? 2.4 : 2.0,
        };
      }
      return {
        fill: tokens.mapUnansweredFill,
        stroke: tokens.mapDuelInactiveStroke,
        strokeWidth: 0.95,
      };
    }

    // Explore mode with active Choropleth thematic layer
    if (mode === 'explore' && choroplethData) {
      const choroplethFill = choroplethData.colors[featureId] || tokens.mapUnansweredFill;
      return {
        fill: choroplethFill,
        stroke: isExploreSelected
          ? tokens.mapChoroplethSelectedStroke
          : isHovered
          ? tokens.mapHoverStroke
          : tokens.mapChoroplethStroke,
        strokeWidth: isExploreSelected ? 2.3 : isHovered ? 1.5 : 0.95,
      };
    }

    if (isChoiceTarget || isExploreSelected) {
      return {
        fill: tokens.mapTargetFill,
        stroke: tokens.mapTargetStroke,
        strokeWidth: 2.0,
      };
    }

    if (mode !== 'explore') {
      if (status === 'correct-first') {
        return {
          fill: '#10B981',
          stroke: tokens.mapSolvedStroke,
          strokeWidth: 1.2,
        };
      }
      if (status === 'correct-assisted') {
        return {
          fill: '#F59E0B',
          stroke: tokens.mapAssistedStroke,
          strokeWidth: 1.2,
        };
      }
      if (status === 'missed') {
        return {
          fill: '#F43F5E',
          stroke: tokens.mapMissedStroke,
          strokeWidth: 1.2,
        };
      }
    }

    if (mode === 'silhouette') {
      return {
        fill: tokens.mapSilhouetteFill,
        stroke: tokens.mapSilhouetteStroke,
        strokeWidth: 1.8,
      };
    }

    return {
      fill: isHovered ? tokens.mapUnansweredHoverFill : tokens.mapUnansweredFill,
      stroke: isHovered ? tokens.mapHoverStroke : tokens.mapStroke,
      strokeWidth: isHovered ? 1.4 : 1.0,
    };
  };

  const hintCentroid = hintPulseId ? centroids.get(hintPulseId) : undefined;
  const targetCentroid = mode === 'choice' && targetId ? centroids.get(targetId) : undefined;
  const exploreCentroid =
    mode === 'explore' && selectedExploreId ? centroids.get(selectedExploreId) : undefined;
  const duelCentroidA = mode === 'duel' && duelHighlight ? centroids.get(duelHighlight.idA) : undefined;
  const duelCentroidB = mode === 'duel' && duelHighlight ? centroids.get(duelHighlight.idB) : undefined;

  const isCursorPassive = mode === 'silhouette' || mode === 'duel' || mode === 'nameAll' || mode === 'ranked';

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${tokens.mapBg} overflow-hidden select-none transition-colors duration-200`}
    >
      {/* Subtle cartographic coordinate crosshair border */}
      {!compact && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-3 border ${tokens.mapFrameBorder} rounded-xl`}
        />
      )}

      {/* First-time zoom gesture tip on clean canvas */}
      {!compact && !hasInteractedZoom && (
        <div className={`pointer-events-none absolute top-3 left-4 z-10 text-[11px] font-medium ${tokens.textMuted}`}>
          {copy.pinchZoomTip}
        </div>
      )}

      {/* Zoom scale readout when zoomed in */}
      {!compact && zoomK > 1.05 && (
        <div className={`pointer-events-none absolute top-3 left-4 z-10 font-mono text-[11px] font-semibold ${tokens.textSecondary} tabular-nums`}>
          {zoomK.toFixed(1)}×
        </div>
      )}

      {/* D3 Vector Map SVG */}
      <svg
        ref={svgRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        role="img"
        aria-label={
          mode === 'silhouette'
            ? 'Bentuk wilayah vektor kecamatan Kabupaten Bekasi'
            : 'Peta vektor 23 kecamatan Kabupaten Bekasi'
        }
      >
        <defs>
          <filter id="bekasi-map-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0F172A" floodOpacity="0.07" />
          </filter>
        </defs>

        <g ref={zoomLayerRef}>
          {/* Vector Polygon Layer */}
          <g filter="url(#bekasi-map-shadow)">
            {(mode === 'silhouette' && silhouetteFeature
              ? [silhouetteFeature]
              : KECAMATAN_FEATURES
            ).map((feature) => {
              const id = feature.properties.id;
              const d = paths.get(id);
              if (!d) return null;

              const style = getPolygonStyle(id);
              return (
                <path
                  key={id}
                  d={d}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth / Math.pow(zoomK, 0.72)}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className={`${
                    isCursorPassive ? 'cursor-default' : 'cursor-pointer'
                  } transition-colors duration-150 focus:outline-none`}
                  onMouseEnter={() => onHoverDistrict(id)}
                  onMouseLeave={() => onHoverDistrict(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDistrict(feature);
                  }}
                />
              );
            })}
          </g>

          {/* Re-stroke active/highlighted polygon on top so borders never clip behind neighbors */}
          {(() => {
            if (mode === 'duel' && duelHighlight) {
              return [duelHighlight.idA, duelHighlight.idB].map((highlightId) => {
                const d = paths.get(highlightId);
                if (!d) return null;
                const style = getPolygonStyle(highlightId);
                return (
                  <path
                    key={`top-${highlightId}`}
                    d={d}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={(style.strokeWidth + 0.5) / Math.pow(zoomK, 0.72)}
                    strokeLinejoin="round"
                    className="pointer-events-none"
                  />
                );
              });
            }

            const topId =
              wrongFlashId ||
              (mode === 'choice' ? targetId : null) ||
              (mode === 'explore' ? selectedExploreId : null);
            if (!topId) return null;
            const d = paths.get(topId);
            if (!d) return null;
            const style = getPolygonStyle(topId);
            return (
              <path
                d={d}
                fill="none"
                stroke={style.stroke}
                strokeWidth={(style.strokeWidth + 0.6) / Math.pow(zoomK, 0.72)}
                strokeLinejoin="round"
                className="pointer-events-none"
              />
            );
          })()}

          {/* Pulsing Area Hint Marker in 'locate' mode */}
          {hintCentroid && (
            <g
              className="pointer-events-none"
              transform={`translate(${hintCentroid[0]}, ${hintCentroid[1]})`}
            >
              <circle
                r={20 / Math.pow(zoomK, 0.7)}
                fill="rgba(37, 99, 235, 0.14)"
                stroke="#2563EB"
                strokeWidth={1.6 / Math.pow(zoomK, 0.7)}
                strokeDasharray={`${3 / Math.pow(zoomK, 0.7)} ${2.5 / Math.pow(zoomK, 0.7)}`}
              />
              <circle r={4 / Math.pow(zoomK, 0.7)} fill="#2563EB" />
            </g>
          )}

          {/* Crisp Target Pin Dot for tiny polygons in 'choice' or 'explore' mode */}
          {(targetCentroid || exploreCentroid) && (
            <g
              className="pointer-events-none"
              transform={`translate(${(targetCentroid || exploreCentroid)![0]}, ${(targetCentroid || exploreCentroid)![1]})`}
            >
              <circle
                r={4.2 / Math.pow(zoomK, 0.7)}
                fill="#FFFFFF"
                stroke="#1E3A8A"
                strokeWidth={1.6 / Math.pow(zoomK, 0.7)}
              />
            </g>
          )}

          {/* Duel A / B Centroid Markers + District Names */}
          {mode === 'duel' && duelHighlight && (
            <>
              {[
                { key: 'A', id: duelHighlight.idA, centroid: duelCentroidA, bg: '#1E3A8A' },
                { key: 'B', id: duelHighlight.idB, centroid: duelCentroidB, bg: '#9A3412' },
              ].map((item) => {
                if (!item.centroid) return null;
                const scaleInv = 1 / Math.pow(zoomK, 0.68);
                const name = KECAMATAN_META_BY_ID[item.id]?.name || '';
                return (
                  <g
                    key={`duel-marker-${item.key}`}
                    className="pointer-events-none"
                    transform={`translate(${item.centroid[0]}, ${item.centroid[1]})`}
                  >
                    <circle
                      r={9 * scaleInv}
                      fill={item.bg}
                      stroke="#FFFFFF"
                      strokeWidth={1.8 * scaleInv}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10 * scaleInv}
                      fontWeight={800}
                      fill="#FFFFFF"
                    >
                      {item.key}
                    </text>
                    <text
                      y={16 * scaleInv}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={9.5 * scaleInv}
                      fontWeight={700}
                      fill={tokens.mapLabelFill}
                      stroke={tokens.mapLabelHalo}
                      strokeWidth={2.8 * scaleInv}
                      strokeLinejoin="round"
                      style={{ paintOrder: 'stroke' }}
                    >
                      {name}
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {/* District Labels (solved districts in quiz modes, or selected in Explore) */}
          {showSolvedLabels &&
            mode !== 'duel' &&
            (mode === 'silhouette' && silhouetteFeature
              ? [silhouetteFeature]
              : KECAMATAN_FEATURES
            ).map((feature) => {
              const id = feature.properties.id;
              const status = statuses[id] || 'unanswered';
              const isSolved = status !== 'unanswered';
              const isSelectedExplore = mode === 'explore' && selectedExploreId === id;

              if (mode === 'explore') {
                if (!isSelectedExplore) return null;
              } else if (!isSolved) {
                return null;
              }

              const centroid = centroids.get(id);
              if (!centroid) return null;

              const fontSize = Math.max(7.5, 10.5 / Math.pow(zoomK, 0.68));
              const strokeW = Math.max(1.8, 3.2 / Math.pow(zoomK, 0.68));

              return (
                <text
                  key={`label-${id}`}
                  x={centroid[0]}
                  y={centroid[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontSize}
                  fontWeight={700}
                  fill={tokens.mapLabelFill}
                  stroke={tokens.mapLabelHalo}
                  strokeWidth={strokeW}
                  strokeLinejoin="round"
                  style={{ paintOrder: 'stroke' }}
                  className="pointer-events-none select-none"
                >
                  {feature.properties.name}
                </text>
              );
            })}
        </g>
      </svg>

      {/* Choropleth Thematic Legend (Explore mode when metric active) */}
      {choroplethData && !compact && (
        <div
          className={`pointer-events-none absolute bottom-3 left-3 z-20 max-w-[230px] sm:max-w-[270px] rounded-xl ${tokens.surfaceElevated} backdrop-blur-xs border ${tokens.border} px-3 py-2 shadow-xs`}
        >
          <div className={`text-[11px] font-bold ${tokens.textPrimary} leading-tight`}>
            {choroplethData.label}
          </div>
          <div
            className={`mt-1.5 h-2.5 w-full rounded-full border ${tokens.border}`}
            style={{ background: choroplethData.gradientCss }}
          />
          <div
            className={`mt-1 flex items-center justify-between gap-3 text-[10px] font-mono tabular-nums ${tokens.textMuted}`}
          >
            <span>{choroplethData.minLabel}</span>
            <span>{choroplethData.maxLabel}</span>
          </div>
        </div>
      )}

      {/* Floating Map Controls (Bottom Right) */}
      {!compact ? (
        <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5">
          {mode !== 'duel' && (
            <button
              type="button"
              onClick={() => setShowSolvedLabels((prev) => !prev)}
              aria-label={showSolvedLabels ? copy.hideLabels : copy.showLabels}
              title={showSolvedLabels ? copy.hideLabels : copy.showLabels}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                showSolvedLabels
                  ? `${tokens.accentBg} text-white border-transparent`
                  : `${tokens.surfaceElevated} ${tokens.textSecondary} ${tokens.border} ${tokens.surfaceHover}`
              }`}
            >
              <Tag className="w-4 h-4" />
            </button>
          )}

          <div
            className={`flex flex-col rounded-xl ${tokens.surfaceElevated} backdrop-blur-sm border ${tokens.border} shadow-sm overflow-hidden`}
          >
            <button
              type="button"
              onClick={() => handleZoomStep(1.45)}
              aria-label={copy.zoomIn}
              title={copy.zoomIn}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${tokens.textSecondary} ${tokens.surfaceHover} border-b ${tokens.border} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleZoomStep(0.68)}
              aria-label={copy.zoomOut}
              title={copy.zoomOut}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${tokens.textSecondary} ${tokens.surfaceHover} border-b ${tokens.border} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`}
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetFit}
              aria-label={copy.resetFit}
              title={copy.resetFit}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${tokens.textSecondary} ${tokens.surfaceHover} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSolvedLabels((prev) => !prev)}
            aria-label={showSolvedLabels ? copy.hideLabels : copy.showLabels}
            title={showSolvedLabels ? copy.hideLabels : copy.showLabels}
            className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border shadow-xs transition-colors ${
              showSolvedLabels
                ? `${tokens.accentBg} text-white border-transparent`
                : `${tokens.surfaceElevated} ${tokens.textSecondary} ${tokens.border} ${tokens.surfaceHover}`
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetFit}
            aria-label={copy.resetMiniFit}
            title={copy.resetMiniFit}
            className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg ${tokens.surfaceElevated} ${tokens.textSecondary} border ${tokens.border} shadow-xs ${tokens.surfaceHover} transition-colors`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
