'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  placeholder?: string;
  paramName?: string;
}

export default function SearchInput({
  placeholder = 'Search...',
  paramName = 'q',
}: SearchInputProps) {
  const [value, setValue] = useState('');

  // Use URL search params for server-side filtering
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set(paramName, value);
    } else {
      url.searchParams.delete(paramName);
    }
    window.location.href = url.toString();
  };

  const handleClear = () => {
    setValue('');
    const url = new URL(window.location.href);
    url.searchParams.delete(paramName);
    window.location.href = url.toString();
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-8 py-2 text-sm
                   focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none
                   placeholder:text-gray-400"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </form>
  );
}
