import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface RetroOption<T extends string | number> {
  value: T;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
}

interface RetroSelectProps<T extends string | number> {
  value: T;
  onChange: (val: T) => void;
  options: RetroOption<T>[];
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function RetroSelect<T extends string | number>({
  value,
  onChange,
  options,
  label,
  disabled = false,
  className = '',
}: RetroSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative font-mono ${className} ${isOpen ? 'z-50' : 'z-auto'}`}
    >
      {label && (
        <label className="block text-[11px] font-bold text-neutral-800 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border-2 border-black bg-white px-3 py-2 text-left font-mono text-xs font-bold shadow-[2px_2px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-between gap-2 cursor-pointer ${
          isOpen ? 'ring-2 ring-amber-400 bg-neutral-50' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="shrink-0 text-black">{selectedOption.icon}</span>
          )}
          <span className="truncate text-black">{selectedOption?.label}</span>
          {selectedOption?.badge && (
            <span
              className={`shrink-0 text-[10px] px-1 py-0.2 border border-black font-mono font-bold ${
                selectedOption.badgeColor || 'bg-neutral-100 text-black'
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-black">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Retro Pixel Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 border-2 border-black bg-white shadow-[4px_4px_0px_#000] max-h-64 overflow-y-auto divide-y-2 divide-black/10">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(opt.value);
                }}
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3 py-2 text-left text-xs font-mono transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                  isSelected
                    ? 'bg-neutral-100 font-bold border-l-4 border-black text-black'
                    : 'hover:bg-amber-100/70 text-neutral-800'
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {opt.subLabel && (
                    <span className="text-[10px] text-neutral-500 font-sans truncate mt-0.5">
                      {opt.subLabel}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {opt.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 border border-black font-mono font-bold ${
                        opt.badgeColor || 'bg-neutral-100 text-black'
                      }`}
                    >
                      {opt.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
