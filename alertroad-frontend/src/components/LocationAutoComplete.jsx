import { useState, useEffect, useRef } from "react";
import "./LocationAutocomplete.css";

function LocationAutocomplete({ value, onChange, onSelectLocation }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 400);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const fetchSuggestions = async (query) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(
          query
        )}`,
        { signal: abortControllerRef.current.signal }
      );
      const data = await response.json();
      setSuggestions(data);
      setShowSuggestions(true);
    } catch (err) {
      if (err.name !== "AbortError") {
        setSuggestions([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    onChange(e.target.value);
  };

  const handleSelectSuggestion = (suggestion) => {
    onSelectLocation({
      address: suggestion.display_name,
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
    });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div className="location-autocomplete" ref={wrapperRef}>
      <input
        type="text"
        className="location-autocomplete-input"
        placeholder="e.g. Commonwealth Ave., Quezon City"
        value={value}
        onChange={handleInputChange}
        onFocus={() => value.trim().length >= 3 && setShowSuggestions(true)}
        autoComplete="off"
      />

      {showSuggestions && (
        <div className="location-autocomplete-menu">
          {isLoading && (
            <p className="location-autocomplete-status">Searching...</p>
          )}

          {!isLoading && suggestions.length === 0 && (
            <p className="location-autocomplete-status">
              No matches found. Try a more specific address.
            </p>
          )}

          {!isLoading &&
            suggestions.map((suggestion) => (
              <button
                key={suggestion.place_id}
                type="button"
                className="location-autocomplete-item"
                onClick={() => handleSelectSuggestion(suggestion)}
              >
                {suggestion.display_name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default LocationAutocomplete;