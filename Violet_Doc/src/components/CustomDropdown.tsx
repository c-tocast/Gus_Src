import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  emoji?: string;
  description?: string;
}

interface CustomDropdownProps<T extends string = string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function CustomDropdown<T extends string = string>({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select an option',
  className = '',
  size = 'md',
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  const isSmall = size === 'sm';

  return (
    <div className={`relative font-sans ${className}`} ref={containerRef}>
      {label && (
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
          {label}
        </label>
      )}

      {/* Control Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-50 hover:bg-slate-100/80 border text-slate-800 rounded-2xl flex items-center justify-between transition-all cursor-pointer shadow-2xs outline-none focus:ring-2 focus:ring-violet-500/20 ${
          isOpen ? 'border-violet-600 bg-white ring-2 ring-violet-500/20' : 'border-slate-200'
        } ${isSmall ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2.5 text-xs'}`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {selectedOption?.emoji && (
            <span className="text-sm shrink-0 leading-none">{selectedOption.emoji}</span>
          )}
          <span className="font-bold text-slate-800 truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-violet-600' : ''
          }`}
        />
      </button>

      {/* Menu Popup */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[200px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-60 overflow-y-auto p-1.5 space-y-0.5">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-violet-50 text-violet-900 font-extrabold'
                    : 'text-slate-700 hover:bg-slate-100/90'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.emoji && <span className="text-sm shrink-0 leading-none">{opt.emoji}</span>}
                  <div className="truncate">
                    <span className="block truncate">{opt.label}</span>
                    {opt.description && (
                      <span className="block text-[10px] text-slate-400 font-normal truncate">
                        {opt.description}
                      </span>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-violet-600 shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
