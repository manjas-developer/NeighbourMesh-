import { useState } from 'react';
import { Home } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function SafeImage({ src, alt, className = '', fallbackLabel }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-500 p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Home className="w-7 h-7 text-[#155E4B]/70 mb-2" strokeWidth={1.75} />
        <span className="text-xs font-medium text-slate-600 max-w-[180px] leading-snug">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
