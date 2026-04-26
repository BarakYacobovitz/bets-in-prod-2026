"use client";
import { useState, useRef, useEffect } from "react";

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  suggestions: string[];
  disabled?: boolean;
  customClassName?: string;
}

export default function AutocompleteInput({ value, onChange, placeholder, suggestions, disabled, customClassName }: AutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.trim() === "") {
      setFilteredSuggestions([]);
    } else {
      const filtered = suggestions.filter(item => 
        item.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    }
  }, [value, suggestions]);

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
        placeholder={placeholder}
        disabled={disabled}
        className={customClassName || `w-full bg-slate-900 text-white font-medium p-4 rounded-xl border border-slate-600 focus:border-amber-500 outline-none transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        autoComplete="off"
      />
      
      {showSuggestions && filteredSuggestions.length > 0 && !disabled && (
        <ul className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => {
                onChange(suggestion);
                setShowSuggestions(false);
              }}
              className="px-4 py-3 text-white hover:bg-amber-500/20 hover:text-amber-400 cursor-pointer transition-colors border-b border-slate-700/50 last:border-0"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}