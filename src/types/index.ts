

import { z } from "zod";

export type QuoteFormData = {
  origin: string;
  destination: string;
  people: number;
  departureDateTime: Date;
  returnDateTime: Date;
  tipoCamino: string;
};

// Represents a single leg of a multi-stop itinerary, calculated by the backend.
export type ItineraryLeg = {
  origin: string;
  destination: string;
  distanceKm: number;
  durationSeconds: number;
  departureTime: Date;
  arrivalTime: Date;
  roadFactorCombustible: number;
  roadFactorDesgaste: number;
};


export type QuoteResult = {
  isItinerary: boolean;
  itinerary: ItineraryLeg[];
  origin: string;
  destination: string;
  people: number;
  baseSubtotal: number;
  costoRenta: number;
  costoCombustible: number;
  costoDesgaste: number;
  costoChofer: number;
  costoCasetas: number | null;
  costoExtra: number | null;
  subtotal: number;
  ajusteClienteFactor: number;
  subtotalAjustado: number;
  tax: number;
  totalSinDescuento: number;
  descuentoMonto: number;
  total: number;
  vehicleName: string;
  realDistanceKm: number;
  totalDistanceKm: number | null;
  tripDurationDays: number | null;
  oneWayTravelHours: number;
  departureDateTime: Date;
  returnDateTime: Date;
  destinationArrivalDateTime: Date;
  originArrivalDateTime: Date;
  // User-modifiable fields
  tipoCliente: string;
  aplicarDescuento: boolean;
  // Fields for live recalculation
  vehicleRendimiento: number;
  vehicleDesgaste: number;
  roadFactorCombustible: number; // For simple quote
  roadFactorDesgaste: number; // For simple quote
  precioCombustible: number;
};

// New schema for the simplified itinerary form
export type AdvancedQuoteStop = {
  destination: string;
  departureDateTime: Date;
  tipoCamino: string;
};

export type AdvancedQuoteFormData = {
  origin: string;
  departureDateTime: Date;
  people: number;
  stops: AdvancedQuoteStop[];
};


// AI Flow Types
export const ExtractQuoteInfoInputSchema = z.object({
  documentText: z.string().describe('The full raw text content of the document to be parsed.'),
});
export type ExtractQuoteInfoInput = z.infer<typeof ExtractQuoteInfoInputSchema>;

const StopSchema = z.object({
    destination: z.string().nullable().describe("The destination for this leg of the trip."),
    arrivalDateTime: z.string().nullable().describe("The arrival date and time for this stop in ISO 8601 format."),
    departureDateTime: z.string().nullable().describe("The departure date and time for this stop in ISO 8601 format."),
});

export const ExtractedQuoteInfoOutputSchema = z.object({
  isItinerary: z.boolean().describe("Set to true if the trip has multiple stops, false otherwise."),
  origin: z.string().nullable().describe("The starting point of the entire trip."),
  destination: z.string().nullable().describe("The final destination for a simple trip. Null for multi-stop itineraries."),
  people: z.number().nullable().describe("The number of people traveling."),
  departureDateTime: z.string().nullable().describe("The departure date and time from the origin in ISO 8601 format."),
  returnDateTime: z.string().nullable().describe("The return date and time to the origin in ISO 8601 format for a simple trip. Null for multi-stop itineraries."),
  stops: z.array(StopSchema).nullable().describe("An array of stops for a multi-stop itinerary. Null for simple trips."),
});
export type ExtractedQuoteInfoOutput = z.infer<typeof ExtractedQuoteInfoOutputSchema>;

export type FontSize = 'sm' | 'md' | 'lg';


// Adding mammoth type declarations here since @types/mammoth does not exist
declare module 'mammoth' {
  interface MammothOptions {
    arrayBuffer: ArrayBuffer;
  }
  interface MammothResult {
    value: string;
    messages: any[];
  }
  export function extractRawText(options: MammothOptions): Promise<MammothResult>;
}
