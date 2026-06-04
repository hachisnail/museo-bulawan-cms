/**
 * PHAddressSelect — Cascading Philippine address picker
 * Province → City/Municipality → Barangay
 *
 * Data source: PSGC REST API (psgc.gitlab.io/api) — no API key required
 * UI: @headlessui/react Combobox (already in deps), styled to zinc/gold theme
 *
 * Props:
 *   value      — { province, city, barangay } — each is { code, name } | null
 *   onChange   — (newValue) => void — called with { province, city, barangay }
 *   required   — marks Province + City as required
 *   disabled   — disables all three dropdowns
 *   className  — extra class on the wrapper
 */

import { useState, useEffect } from 'react';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { ChevronDown, X, Loader2, MapPin } from 'lucide-react';

// ─── PSGC API base ────────────────────────────────────────────────────────────

const PSGC = 'https://psgc.gitlab.io/api';

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function sortByName(arr) {
  return [...arr].sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Single searchable combobox ───────────────────────────────────────────────

function AddressCombobox({ label, placeholder, options, value, onChange, disabled, loading, required }) {
  const [query, setQuery] = useState('');

  // Reset search string whenever the selected value changes externally
  useEffect(() => { setQuery(''); }, [value]);

  const filtered =
    query.trim() === ''
      ? options
      : options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>

      <Combobox
        value={value}
        onChange={(opt) => { setQuery(''); onChange(opt); }}
        disabled={disabled || loading}
      >
        {/* Input + icon row */}
        <div className="relative">
          <ComboboxInput
            autoComplete="off"
            className="w-full bg-zinc-50 border border-zinc-300 rounded-sm pl-4 pr-16 py-3 text-sm text-black
                       focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]
                       transition-all font-medium
                       placeholder:text-zinc-400 placeholder:font-normal
                       disabled:opacity-50 disabled:cursor-not-allowed"
            displayValue={(opt) => opt?.name ?? ''}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={loading ? 'Loading…' : placeholder}
          />

          <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-0.5">
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
            ) : value ? (
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Clear ${label}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setQuery('');
                  onChange(null);
                }}
                className="p-1 rounded-sm text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            ) : null}
            <ComboboxButton className="p-1 rounded-sm text-zinc-400 hover:text-zinc-700 transition-colors">
              <ChevronDown className="w-4 h-4" />
            </ComboboxButton>
          </div>
        </div>

        {/* Dropdown list — portaled via HUI v2 anchor, matches input width */}
        <ComboboxOptions
          anchor="bottom start"
          className="z-50 mt-0.5 [--anchor-gap:4px] w-[var(--input-width)]
                     max-h-64 overflow-auto
                     bg-white border border-zinc-200 rounded-sm shadow-xl
                     py-1 text-sm focus:outline-none empty:hidden"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-xs text-zinc-400 italic text-center">
              {query ? `No results for "${query}"` : 'No options available'}
            </div>
          ) : (
            filtered.map((opt) => (
              <ComboboxOption
                key={opt.code}
                value={opt}
                className="px-4 py-2 cursor-pointer select-none text-sm text-zinc-700 transition-colors
                           data-[active]:bg-zinc-50
                           data-[selected]:font-semibold data-[selected]:text-[#D4AF37]"
              >
                {opt.name}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </Combobox>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PHAddressSelect({
  value = {},
  onChange,
  required = false,
  disabled = false,
  className = '',
}) {
  const [provinces,      setProvinces]      = useState([]);
  const [cities,         setCities]         = useState([]);
  const [barangays,      setBarangays]      = useState([]);

  const [loadingProvinces,  setLoadingProvinces]  = useState(true);
  const [loadingCities,     setLoadingCities]     = useState(false);
  const [loadingBarangays,  setLoadingBarangays]  = useState(false);
  const [fetchError,        setFetchError]        = useState(null);

  // Normalise — value props may be undefined
  const province = value?.province ?? null;
  const city     = value?.city     ?? null;
  const barangay = value?.barangay ?? null;

  // ── Load provinces (once on mount) ─────────────────────────────────────────

  useEffect(() => {
    setLoadingProvinces(true);
    setFetchError(null);
    fetchJSON(`${PSGC}/provinces/`)
      .then((data) => setProvinces(sortByName(data)))
      .catch(() => setFetchError('Could not load provinces. Check your internet connection.'))
      .finally(() => setLoadingProvinces(false));
  }, []);

  // ── Load cities/municipalities when province changes ────────────────────────

  useEffect(() => {
    if (!province?.code) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    setFetchError(null);
    fetchJSON(`${PSGC}/provinces/${province.code}/cities-municipalities/`)
      .then((data) => setCities(sortByName(data)))
      .catch(() => setFetchError('Could not load cities / municipalities.'))
      .finally(() => setLoadingCities(false));
  }, [province?.code]);

  // ── Load barangays when city changes ────────────────────────────────────────

  useEffect(() => {
    if (!city?.code) {
      setBarangays([]);
      return;
    }
    setLoadingBarangays(true);
    setFetchError(null);
    fetchJSON(`${PSGC}/cities-municipalities/${city.code}/barangays/`)
      .then((data) => setBarangays(sortByName(data)))
      .catch(() => setFetchError('Could not load barangays.'))
      .finally(() => setLoadingBarangays(false));
  }, [city?.code]);

  // ── Change handlers (cascade clears downstream) ─────────────────────────────

  const handleProvince = (p) => onChange({ province: p, city: null, barangay: null });
  const handleCity     = (c) => onChange({ province, city: c, barangay: null });
  const handleBarangay = (b) => onChange({ province, city, barangay: b });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-zinc-400" />
        <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
          Philippine Address
        </span>
      </div>

      {/* API error banner */}
      {fetchError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
          {fetchError}
        </div>
      )}

      {/* Province */}
      <AddressCombobox
        label="Province"
        placeholder="Search province…"
        options={provinces}
        value={province}
        onChange={handleProvince}
        disabled={disabled}
        loading={loadingProvinces}
        required={required}
      />

      {/* City / Municipality */}
      <AddressCombobox
        label="City / Municipality"
        placeholder={province ? 'Search city or municipality…' : 'Select a province first'}
        options={cities}
        value={city}
        onChange={handleCity}
        disabled={disabled || !province}
        loading={loadingCities}
        required={required}
      />

      {/* Barangay */}
      <AddressCombobox
        label="Barangay"
        placeholder={city ? 'Search barangay…' : 'Select a city or municipality first'}
        options={barangays}
        value={barangay}
        onChange={handleBarangay}
        disabled={disabled || !city}
        loading={loadingBarangays}
      />
    </div>
  );
}
