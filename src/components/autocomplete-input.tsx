
'use client';

import React, { useRef, useEffect } from 'react';
import { Input } from './ui/input';
import { MapPin } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder: string;
  className?: string;
  isLoaded: boolean; // Receives the load state from the parent
}

const AutocompleteInput = ({ value, onChange, onBlur, placeholder, className, isLoaded }: AutocompleteInputProps) => {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isLoaded && inputRef.current && !autocompleteRef.current) {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'mx' },
        fields: ['formatted_address', 'name'],
        types: ['geocode'],
      });

      autocompleteRef.current = autocomplete;

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const newAddress = place.formatted_address || place.name || '';
        // Directly call onChange to update react-hook-form's state
        onChange(newAddress);
        // DO NOT trigger blur here, as it can cause premature form submissions/validations.
        // onBlur(); 
      });
    }
  }, [isLoaded, onChange, onBlur]);

  // This effect ensures that if the form is reset externally, the input reflects the new value.
  useEffect(() => {
    if (inputRef.current && value !== inputRef.current.value) {
      inputRef.current.value = value;
    }
  }, [value]);

  if (!isLoaded) {
    return (
        <div className="relative">
             <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
             <Skeleton className="h-10 w-full pl-10" />
        </div>
    );
  }

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        className={cn('pl-10', className)}
        defaultValue={value}
        onBlur={onBlur} // This ensures validation triggers on blur
        // Let react-hook-form handle the state, but allow manual typing.
        // The default value is set from the form state.
        onChange={(e) => onChange(e.target.value)}
        disabled={!isLoaded}
      />
    </div>
  );
};

export default AutocompleteInput;
