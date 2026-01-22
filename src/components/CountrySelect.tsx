'use client';

import { useState, useEffect, useRef } from 'react';
import { countries, TCountryCode } from 'countries-list';

interface CountrySelectProps {
    value: string;
    onChange: (value: string) => void;
    label: string;
    error?: string;
    placeholder?: string;
}

interface CountryOption {
    code: string;
    name: string;
    emoji: string;
}



export default function CountrySelect({
    value,
    onChange,
    label,
    error,
    placeholder = 'Select a country'
}: CountrySelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Convert countries object to array and sort by name
    const countryList: CountryOption[] = Object.entries(countries).map(([code, data]) => ({
        code,
        name: data.name,
        emoji: code,
    })).sort((a, b) => a.name.localeCompare(b.name));

    const filteredCountries = countryList.filter(country =>
        country.name.toLowerCase().includes(search.toLowerCase())
    );

    const selectedCountry = countryList.find(c => c.name === value);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="w-full relative" ref={containerRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {label}
            </label>

            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-4 py-3 rounded-lg border-2 text-left flex items-center justify-between ${error
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-gray-300 hover:border-orange-500 dark:border-gray-600 dark:hover:border-orange-400'
                    } bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200 outline-none focus:ring-2 focus:ring-orange-500/20`}
            >
                <span className={!selectedCountry ? 'text-gray-400' : ''}>
                    {selectedCountry ? (
                        <span className="flex items-center gap-2">
                            <img
                                src={`https://flagcdn.com/${selectedCountry.code.toLowerCase()}.svg`}
                                alt={selectedCountry.name}
                                className="w-5 h-5 object-cover rounded-sm"
                            />
                            {selectedCountry.name}
                        </span>
                    ) : (
                        placeholder
                    )}
                </span>
                <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar país..."
                            className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 text-sm"
                            autoFocus
                        />
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1">
                        {filteredCountries.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                No se encontraron países
                            </div>
                        ) : (
                            filteredCountries.map((country) => (
                                <button
                                    key={country.code}
                                    type="button"
                                    onClick={() => {
                                        onChange(country.name);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className={`w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors ${value === country.name ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-medium' : 'text-gray-700 dark:text-gray-200'
                                        }`}
                                >
                                    <img
                                        src={`https://flagcdn.com/${country.code.toLowerCase()}.svg`}
                                        alt={country.name}
                                        className="w-5 h-5 object-cover rounded-sm"
                                    />
                                    <span className="truncate">{country.name}</span>
                                    {value === country.name && (
                                        <svg className="w-4 h-4 ml-auto text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {error && (
                <p className="mt-1 text-sm text-red-500">{error}</p>
            )}
        </div>
    );
}
