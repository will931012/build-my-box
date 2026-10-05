import { useState } from 'react';
import type { PackagingType } from '@bmb/shared';
import { cx } from './ui';

/**
 * Foto del producto si tiene `imageUrl`; si no (o si falla), una ilustración SVG
 * según el tipo de empaque, en el mismo color que el producto tiene en la vista 3D.
 */
export function ProductArt({
  imageUrl,
  packagingType,
  color,
  name,
  className,
}: {
  imageUrl: string | null;
  packagingType: PackagingType;
  color: string;
  name: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (imageUrl && !broken) {
    return <img src={imageUrl} alt={name} loading="lazy" onError={() => setBroken(true)} className={cx('object-cover', className)} />;
  }
  return (
    <div className={cx('flex items-center justify-center', className)} style={{ background: `${color}22` }} role="img" aria-label={name}>
      <svg viewBox="0 0 64 64" className="h-3/4 w-3/4" aria-hidden="true">
        <Shape type={packagingType} color={color} />
      </svg>
    </div>
  );
}

function Shape({ type, color }: { type: PackagingType; color: string }) {
  const stroke = '#1c1917';
  const sw = 1.6;
  switch (type) {
    case 'CAN':
      return (
        <g stroke={stroke} strokeWidth={sw}>
          <path d="M16 18v28c0 4 7 7 16 7s16-3 16-7V18" fill={color} />
          <ellipse cx="32" cy="18" rx="16" ry="6" fill="#e7e5e4" />
          <path d="M16 30c0 4 7 7 16 7s16-3 16-7" fill="none" opacity=".5" />
        </g>
      );
    case 'BOTTLE':
    case 'LIQUID':
      return (
        <g stroke={stroke} strokeWidth={sw}>
          <rect x="27" y="5" width="10" height="7" rx="1.5" fill="#e7e5e4" />
          <path d="M27 12h10v5c6 3 9 7 9 12v24c0 3-2 5-5 5H23c-3 0-5-2-5-5V29c0-5 3-9 9-12z" fill={color} />
          <rect x="22" y="32" width="20" height="12" rx="2" fill="#fff" opacity=".75" />
        </g>
      );
    case 'JAR':
      return (
        <g stroke={stroke} strokeWidth={sw}>
          <rect x="18" y="10" width="28" height="8" rx="2" fill="#a8a29e" />
          <path d="M18 18h28v32c0 4-3 6-6 6H24c-3 0-6-2-6-6z" fill={color} opacity=".85" />
          <path d="M23 24v22" stroke="#fff" strokeWidth="3" opacity=".6" />
        </g>
      );
    case 'BAG':
      return (
        <g stroke={stroke} strokeWidth={sw}>
          <path d="M14 14h36l-2 4 3 30c0 4-3 7-7 7H20c-4 0-7-3-7-7l3-30z" fill={color} />
          <path d="M14 14l4 4h28l4-4" fill="none" />
          <rect x="22" y="30" width="20" height="12" rx="2" fill="#fff" opacity=".7" />
        </g>
      );
    case 'SOFT':
      return (
        <g stroke={stroke} strokeWidth={sw}>
          <rect x="10" y="18" width="44" height="32" rx="12" fill={color} />
          <circle cx="22" cy="34" r="6" fill="#fff" opacity=".7" />
          <circle cx="42" cy="34" r="6" fill="#fff" opacity=".7" />
        </g>
      );
    case 'FRAGILE':
      return (
        <g stroke={stroke} strokeWidth={sw}>
          <path d="M10 22l22-10 22 10v24L32 56 10 46z" fill={color} />
          <path d="M10 22l22 10 22-10M32 32v24" fill="none" />
          <path d="M27 18h10l-2 7h-6zM32 25v6" fill="#fff" />
        </g>
      );
    case 'BOX':
    case 'RIGID':
    default:
      return (
        <g stroke={stroke} strokeWidth={sw}>
          <path d="M10 22l22-10 22 10v24L32 56 10 46z" fill={color} />
          <path d="M10 22l22 10 22-10M32 32v24" fill="none" />
          <path d="M21 17l22 10" opacity=".5" />
        </g>
      );
  }
}
