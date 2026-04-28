"use client";
import { useState, useRef, useEffect } from "react";

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  suggestions: string[];
  disabled?: boolean;
  customClassName?: string;
  getFlag?: (val: string) => string | null | undefined;
  getSubtitle?: (val: string) => string | null | undefined;
  showAllOnFocus?: boolean;
}

export default function AutocompleteInput({ 
  value, 
  onChange, 
  placeholder, 
  suggestions, 
  disabled, 
  customClassName,
  getFlag,
  getSubtitle,
  showAllOnFocus = false
}: AutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.trim() === "") {
      setFilteredSuggestions(showAllOnFocus ? suggestions : []);
    } else {
      const filtered = suggestions.filter(item => 
        item.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    }
  }, [value, suggestions, showAllOnFocus]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onClick={() => setShowSuggestions(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={customClassName || `w-full bg-slate-900 text-white font-medium p-4 rounded-xl border border-slate-600 focus:border-amber-500 outline-none transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        autoComplete="off"
      />
      
      {/* חץ קטן שמעיד על כך שאפשר לפתוח רשימה (אם מוגדר showAllOnFocus) */}
      {showAllOnFocus && !disabled && (
         <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs">
           ▼
         </div>
      )}
      
      {showSuggestions && filteredSuggestions.length > 0 && !disabled && (
        <ul className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl max-h-56 overflow-y-auto custom-scrollbar">
          {filteredSuggestions.map((suggestion, index) => {
            const flag = getFlag ? getFlag(suggestion) : null;
            const subtitle = getSubtitle ? getSubtitle(suggestion) : null;

            return (
              <li
                key={index}
                onClick={() => {
                  onChange(suggestion);
                  setShowSuggestions(false);
                }}
                className="px-4 py-3 text-white hover:bg-amber-500/20 hover:text-amber-400 cursor-pointer transition-colors border-b border-slate-700/50 last:border-0 flex items-center gap-2.5"
              >
                {flag && <img src={flag} alt="flag" className="w-5 h-3.5 object-cover rounded-sm shadow-sm" />}
                <span className="font-bold text-sm">{suggestion}</span>
                {subtitle && <span className="text-slate-400 text-[11px] pr-1">({subtitle})</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}