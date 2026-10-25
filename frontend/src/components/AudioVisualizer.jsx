import React, { useEffect, useRef } from 'react';

export default function AudioVisualizer({ audioLevel = 0, isSpeaking = false, isActive = false }) {
  const canvasRef = useRef(null);
  const phaseRef = useRef(0);
  const barsRef = useRef(new Array(20).fill(3));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const render = () => {
      phaseRef.current += 0.06;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const numBars = 20;
      const barWidth = 4;
      const gap = (width - numBars * barWidth) / (numBars - 1);

      for (let i = 0; i < numBars; i++) {
        let targetHeight = 4;

        if (isActive) {
          if (isSpeaking || audioLevel > 5) {
            const distFromCenter = Math.abs(i - numBars / 2) / (numBars / 2);
            const wave = Math.sin(phaseRef.current * 2 + i * 0.4) * 0.5 + 0.5;
            const factor = Math.max(0.15, 1 - distFromCenter * 0.5);
            targetHeight = Math.max(4, (audioLevel / 100) * (height - 6) * factor * (wave * 0.7 + 0.3));
          } else {
            targetHeight = 4 + Math.sin(phaseRef.current + i * 0.3) * 2;
          }
        }

        barsRef.current[i] += (targetHeight - barsRef.current[i]) * 0.3;
        const h = Math.min(height - 4, Math.max(3, barsRef.current[i]));
        const x = i * (barWidth + gap);
        const y = (height - h) / 2;

        // Clean modern blue or soft neutral bar
        ctx.fillStyle = isActive && isSpeaking ? '#3b82f6' : '#3f3f46';

        // Rounded pill shape
        const radius = barWidth / 2;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, y + h - radius);
        ctx.quadraticCurveTo(x + barWidth, y + h, x + barWidth - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [audioLevel, isSpeaking, isActive]);

  return (
    <div className="flex items-center justify-center py-2">
      <canvas
        ref={canvasRef}
        width={180}
        height={32}
        className="w-[180px] h-[32px] block"
      />
    </div>
  );
}
