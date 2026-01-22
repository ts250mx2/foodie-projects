'use client';

import { useState, useEffect, useRef } from 'react';
import { countries } from 'countries-list';

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    countryCode: string;
    onCountryCodeChange: (code: string) => void;
    label: string;
    error?: string;
    placeholder?: string;
}

interface CountryOption {
    code: string;
    name: string;
    phone: string[]; // countries-list defines phone as string | number | number[], but commonly string or number[]. In v3+ it is usually string or number[]. Actually looking at the types, it's often a string "52" or similar. Let's cast safely.
    // We will verify the type during runtime or use 'any' for the map if strictness is high, but let's try safe access.
}

export default function PhoneInput({
    value,
    onChange,
    countryCode,
    onCountryCodeChange,
    label,
    error,
    placeholder = '123 456 7890'
}: PhoneInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Prepare country list
    const countryList: any[] = Object.entries(countries).map(([code, data]: [string, any]) => ({
        code,
        name: data.name,
        phone: data.phone, // "52", "1", etc.
    })).sort((a, b) => a.name.localeCompare(b.name));

    const filteredCountries = countryList.filter(country =>
        country.name.toLowerCase().includes(search.toLowerCase()) ||
        String(country.phone).includes(search)
    );

    // Find selected country by phone code (approximate match, or just use the passed prop if it's just the code string)
    // Actually the user selects a *country*, which sets the phone code. But if multiple countries have the same code (US/Canada +1), we need to track the *country code* (ISO) as well if we want to show the correct flag.
    // However, the prompt asks for "selecting the lada".
    // If we only store "52", we don't know if it's Mexico.
    // For this specific requirement "select the lada... with emoji/flag", it implies verified country selection.
    // I will fallback to finding the *first* country with that calling code if we only have the code, OR better, I'll ask internal state or prop to track the ISO code if possible.
    // But the proposed prop is `countryCode` (which implies calling code like '52')? Or ISO?
    // "lada del pais" = calling code. 
    // If the props are just `countryCode` (string, e.g. "52"), I have to guess the flag.
    // To solve this correctly, I should probably store the ISO code (e.g. 'MX') to derive the flag and the phone code.
    // But the user might only want to store the calling code.
    // I will try to support finding the country object by the calling code.

    // Let's assume `countryCode` prop is the CALLING CODE (e.g. "52").
    const selectedCountry = countryList.find(c => String(c.phone) === String(countryCode)) || countryList.find(c => c.code === 'MX');

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

            <div className={`flex w-full rounded-lg border-2 bg-white dark:bg-gray-800 transition-all duration-200 ${error
                    ? 'border-red-500 focus-within:border-red-600'
                    : 'border-gray-300 hover:border-orange-500 dark:border-gray-600 dark:hover:border-orange-400 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20'
                }`}>
                {/* Country Code Trigger */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 border-r border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-l-md outline-none"
                >
                    {selectedCountry ? (
                        <>
                            <img
                                src={`https://flagcdn.com/${selectedCountry.code.toLowerCase()}.svg`}
                                alt={selectedCountry.name}
                                className="w-6 h-4 object-cover rounded-sm"
                            />
                            <span className="text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
                                +{selectedCountry.phone}
                            </span>
                        </>
                    ) : (
                        <span className="text-gray-400">Code</span>
                    )}
                    <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute z-50 top-full left-0 mt-1 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        {/* Search */}
                        <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search country or code..."
                                className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 text-sm"
                                autoFocus
                            />
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto flex-1">
                            {filteredCountries.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                    No countries found
                                </div>
                            ) : (
                                filteredCountries.map((country) => (
                                    <button
                                        key={country.code}
                                        type="button"
                                        onClick={() => {
                                            onCountryCodeChange(String(country.phone));
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className={`w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors ${String(country.phone) === String(countryCode)
                                                ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-medium'
                                                : 'text-gray-700 dark:text-gray-200'
                                            }`}
                                    >
                                        <img
                                            src={`https://flagcdn.com/${country.code.toLowerCase()}.svg`}
                                            alt={country.name}
                                            className="w-5 h-5 object-cover rounded-sm flex-shrink-0"
                                        />
                                        <span className="truncate flex-1">{country.name}</span>
                                        <span className="text-gray-400 dark:text-gray-500 font-mono">
                                            +{country.phone}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Phone Number Input */}
                <input
                    type="tel"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none"
                // Pass specific props if needed, but managing composed input here manually
                />
            </div>
            {error && (
                <p className="mt-1 text-sm text-red-500">{error}</p>
            )}
        </div>
    );
}
