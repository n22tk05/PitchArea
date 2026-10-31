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
      className={`relative font-sans ${className} ${isOpen ? 'z-50' : 'z-auto'}`}
    >
      {label && (
        <label className="block text-xs font-headline font-bold text-[#1C1917] mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border border-[#D97706]/35 bg-[#FFFFFF] px-3.5 py-2.5 text-left font-sans text-xs font-semibold shadow-xs hover:border-[#B45309] hover:bg-[#FAF8F5] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-between gap-2 cursor-pointer rounded-xl ${
          isOpen ? 'ring-2 ring-[#D97706]/50 border-[#B45309] bg-[#FEF3C7]/20' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="shrink-0 text-[#B45309]">{selectedOption.icon}</span>
          )}
          <span className="truncate text-[#1C1917] font-bold text-xs">{selectedOption?.label}</span>
          {selectedOption?.badge && (
            <span
              className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-[#F59E0B]/50 font-mono font-bold bg-[#FEF3C7] text-[#92400E] shadow-xs`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-[#B45309]">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Retro Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-[#D97706]/35 bg-[#FFFFFF] shadow-[0_12px_36px_rgba(217,119,6,0.14)] max-h-64 overflow-y-auto divide-y divide-[#D97706]/15 font-sans">
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
                className={`w-full px-3.5 py-2.5 text-left text-xs font-sans transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#FEF3C7] font-bold border-l-4 border-l-[#B45309] text-[#92400E]'
                    : 'hover:bg-[#FAF8F5] text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {opt.icon && <span className="shrink-0 text-[#B45309]">{opt.icon}</span>}
                    <span className="truncate font-headline font-semibold text-xs">{opt.label}</span>
                  </div>
                  {opt.subLabel && (
                    <span className="text-[11px] text-[#78716C] font-sans truncate mt-0.5">
                      {opt.subLabel}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {opt.badge && (
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full border border-[#F59E0B]/50 font-mono font-bold bg-[#FEF3C7] text-[#92400E]`}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#B45309]" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
