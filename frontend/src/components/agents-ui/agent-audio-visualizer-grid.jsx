import React, { useEffect, useRef, useState } from 'react';

export function AgentAudioVisualizerGrid({
  size = 'xl',
  color = '#C04CFA',
  rowCount = 15,
  columnCount = 15,
  radius = 60,
  state = 'speaking',
  audioTrack,
  audioLevel = 0,
  className = '',
  ...props
}) {
  const containerRef = useRef(null);
  const [pulsePhase, setPulsePhase] = useState(0);
  const animRef = useRef(null);

  // Smooth animation loop
  useEffect(() => {
    let phase = 0;
    const animate = () => {
      phase += state === 'speaking' ? 0.08 : state === 'listening' ? 0.03 : 0.02;
      setPulsePhase(phase);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [state]);

  // Center of the grid
  const centerRow = (rowCount - 1) / 2;
  const centerCol = (columnCount - 1) / 2;
  const maxDistance = Math.sqrt(centerRow * centerRow + centerCol * centerCol);

  // Calculate cell opacity and scale
  const getCellMetrics = (r, c) => {
    const dRow = r - centerRow;
    const dCol = c - centerCol;
    const distance = Math.sqrt(dRow * dRow + dCol * dCol);

    // Limit to circular/oval radius
    const normalizedDist = distance / maxDistance;
    if (normalizedDist > 0.95) {
      return { opacity: 0, scale: 0 };
    }

    let opacity = 0.15;
    let scale = 0.5;

    if (state === 'speaking') {
      // Expanding ripple waves from center modulated by audioLevel
      const wave = Math.sin(pulsePhase * 3 - distance * 0.8);
      const intensity = Math.max(0, wave);
      const levelFactor = Math.max(0.4, audioLevel / 70);
      opacity = 0.2 + intensity * 0.8 * levelFactor;
      scale = 0.4 + intensity * 0.7 * levelFactor;
    } else if (state === 'listening') {
      // Gentle breathing pulse
      const breathe = Math.sin(pulsePhase * 2) * 0.5 + 0.5;
      const falloff = Math.max(0, 1 - normalizedDist * 1.5);
      opacity = 0.15 + breathe * 0.6 * falloff;
      scale = 0.4 + breathe * 0.4 * falloff;
    } else if (state === 'thinking') {
      // Rotating radar angle
      const angle = Math.atan2(dRow, dCol);
      const sweep = Math.sin(angle + pulsePhase * 2) * 0.5 + 0.5;
      opacity = 0.1 + sweep * 0.8;
      scale = 0.3 + sweep * 0.6;
    } else {
      // Idle resting state
      const idle = Math.sin(pulsePhase + (r + c) * 0.2) * 0.5 + 0.5;
      opacity = 0.1 + idle * 0.2;
      scale = 0.4;
    }

    return {
      opacity: Math.min(1, Math.max(0.08, opacity)),
      scale: Math.min(1.2, Math.max(0.2, scale)),
    };
  };

  return (
    <div
      ref={containerRef}
      className={`grid place-content-center select-none ${className}`}
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
        aspectRatio: '1 / 1',
        maxWidth: size === 'xl' ? '280px' : size === 'lg' ? '220px' : '160px',
        maxHeight: size === 'xl' ? '280px' : size === 'lg' ? '220px' : '160px',
      }}
      {...props}
    >
      {Array.from({ length: rowCount }).map((_, r) =>
        Array.from({ length: columnCount }).map((_, c) => {
          const { opacity, scale } = getCellMetrics(r, c);

          return (
            <div
              key={`${r}-${c}`}
              className="flex items-center justify-center p-[2px]"
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: `${radius}%`,
                  backgroundColor: color,
                  opacity,
                  transform: `scale(${scale})`,
                  transition: 'transform 0.08s ease-out, opacity 0.08s ease-out',
                  boxShadow: opacity > 0.6 ? `0 0 6px ${color}` : 'none',
                }}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
