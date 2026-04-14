
"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import type { QuoteFormData, QuoteResult, Vehicle, ItineraryLeg } from '@/types';
import { getVehicles } from '@/lib/vehicle-data';
import { loadGasPrice } from '@/lib/app-config';
import { roadTypeFactors, clientTypeFactors } from '@/lib/pricing-factors';
import { COMPANY_BASE } from '@/app/page';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calculator, Calendar as CalendarIcon, Loader2, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AutocompleteInput from "./autocomplete-input";

const functions = getFunctions(app, 'us-central1');
const getDistanceFunction = httpsCallable(functions, 'getDistance');

type DistanceResultData = {
    roundTripDistanceKm: number;
    roundTripDurationSeconds?: number;
    routeDescription?: string;
};

const formSchema = z.object({
  origin: z.string().min(3, { message: "El origen debe tener al menos 3 caracteres." }),
  destination: z.string().min(3, { message: "El destino debe tener al menos 3 caracteres." }),
  people: z.coerce.number().int().min(1, { message: "Debe haber al menos 1 pasajero." }),
  departureDateTime: z.date({
    required_error: "Se requiere una fecha y hora de salida.",
  }),
  returnDateTime: z.date({
    required_error: "Se requiere una fecha y hora de regreso.",
  }),
  tipoCamino: z.string({ required_error: "Debe seleccionar un tipo de camino." }),
}).refine((data) => {
    if (!(data.departureDateTime instanceof Date) || !(data.returnDateTime instanceof Date)) {
        return false;
    }
    return data.returnDateTime > data.departureDateTime;
}, {
  message: "La fecha de regreso debe ser posterior a la fecha de salida.",
  path: ["returnDateTime"],
});

type QuoteFormValues = z.infer<typeof formSchema>;

interface QuoteFormProps {
  onQuoteCalculated: (data: QuoteResult) => void;
  onCalculationStart: () => void;
  isMapsApiLoaded: boolean;
}

const combineDateAndTime = (date: Date, timeValue: string): Date => {
    if (!date || !timeValue) return date;
    const [hours, minutes] = timeValue.split(':').map(Number);
    const newDate = new Date(date);
    if (!isNaN(hours) && !isNaN(minutes)) {
        newDate.setHours(hours, minutes, 0, 0);
    }
    return newDate;
};

export const QuoteForm = forwardRef<any, QuoteFormProps>(({ onQuoteCalculated, onCalculationStart, isMapsApiLoaded }, ref) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      origin: "Oaxaca de Juárez, Oaxaca",
      destination: "",
      people: 1,
      departureDateTime: new Date(),
      returnDateTime: addDays(new Date(), 1),
      tipoCamino: "pista",
    },
  });

  useImperativeHandle(ref, () => ({
    reset(values?: QuoteFormValues) {
      form.reset(values);
    }
  }));

  const departureDate = form.watch("departureDateTime");

  const isAtBase = (origin: string): boolean => {
    if (!origin) return false;
    const normalized = origin.trim().toLowerCase();
    const parts = normalized.split(',');
    return parts[0].includes('oaxaca');
  };

  const handleCalculateQuote = async (data: QuoteFormValues) => {
    setIsLoading(true);
    onCalculationStart();
    setError(null);

    const vehicles = await getVehicles();
    const gasPrice = await loadGasPrice(); // Await Firestore load

    if (vehicles.length === 0) {
        setError("No hay vehículos configurados para realizar un cálculo.");
        setIsLoading(false);
        return;
    }

    if (data.origin.trim().toLowerCase() === data.destination.trim().toLowerCase()) {
        setError("El origen y el destino no pueden ser iguales. Por favor, elija un destino diferente.");
        setIsLoading(false);
        return;
    }

    try {
        const tripDistanceResult = await getDistanceFunction({ 
            origin: data.origin, 
            destination: data.destination 
        }) as HttpsCallableResult<DistanceResultData>;

        if (typeof tripDistanceResult.data?.roundTripDistanceKm !== 'number') {
            throw new Error("La API de mapas no devolvió una distancia válida para la ruta principal.");
        }
        
        let apiDistanceKm = tripDistanceResult.data.roundTripDistanceKm;
        
        if (!isAtBase(data.origin)) {
            try {
                 const baseToOriginDistanceResult = await getDistanceFunction({
                    origin: COMPANY_BASE,
                    destination: data.origin,
                }) as HttpsCallableResult<DistanceResultData>;

                if (baseToOriginDistanceResult.data?.roundTripDistanceKm) {
                    apiDistanceKm += baseToOriginDistanceResult.data.roundTripDistanceKm;
                }
            } catch (e) {
                console.warn(`Could not calculate distance from base to origin (Origin: "${data.origin}"). This is expected if the origin is the base city. Assuming 0km.`, e);
            }
        }

        const oneWayDurationSeconds = (tripDistanceResult.data.roundTripDurationSeconds || 0) / 2;
        const oneWayDistanceKm = tripDistanceResult.data.roundTripDistanceKm / 2;
        
        const roadFactor = roadTypeFactors.find(f => f.id === data.tipoCamino);
        if (!roadFactor) {
            throw new Error("Factor de camino no encontrado. Verifique la configuración.");
        }

        const itineraryLegs: ItineraryLeg[] = [
            {
                origin: data.origin,
                destination: data.destination,
                distanceKm: oneWayDistanceKm,
                durationSeconds: oneWayDurationSeconds,
                departureTime: data.departureDateTime,
                arrivalTime: new Date(data.departureDateTime.getTime() + oneWayDurationSeconds * 1000),
                roadFactorCombustible: roadFactor.combustible,
                roadFactorDesgaste: roadFactor.desgaste,
            },
            {
                origin: data.destination,
                destination: data.origin,
                distanceKm: oneWayDistanceKm,
                durationSeconds: oneWayDurationSeconds,
                departureTime: data.returnDateTime,
                arrivalTime: new Date(data.returnDateTime.getTime() + oneWayDurationSeconds * 1000),
                roadFactorCombustible: roadFactor.combustible,
                roadFactorDesgaste: roadFactor.desgaste,
            }
        ];
        
        const suitableVehicles = vehicles
            .filter(v => v.capacidad >= data.people)
            .sort((a, b) => a.capacidad - b.capacidad);

        if (suitableVehicles.length === 0) {
            throw new Error(`No se encontró un vehículo con capacidad para ${data.people} personas.`);
        }
        const vehicle = suitableVehicles[0];

        // LOGIC: Calendary days difference. 29 Oct to 30 Oct = 2 days regardless of time.
        const startDay = new Date(data.departureDateTime);
        startDay.setHours(0, 0, 0, 0);
        const endDay = new Date(data.returnDateTime);
        endDay.setHours(0, 0, 0, 0);
        const diffInMs = endDay.getTime() - startDay.getTime();
        const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24)) + 1;

        const numDays = Math.max(1, diffInDays);


        const additionalKmsForDays = (Math.ceil(numDays) - 1) * 50;
        const totalCalculatedDistanceKm = apiDistanceKm + additionalKmsForDays;

        const initialTipoCliente = 'tipo1';
        const initialCostoPeaje = 0;
        const initialCostoExtra = 0;
        const initialAplicarDescuento = false;
        
        const clientFactor = clientTypeFactors.find(f => f.id === initialTipoCliente);
        if (!clientFactor) {
             throw new Error("Factor de cliente inicial no encontrado.");
        }

        const costoRenta = vehicle.costos.rentaDiaria * numDays;
        const litrosCombustible = (totalCalculatedDistanceKm / vehicle.costos.rendimientoKmLitro) * roadFactor.combustible;
        const costoCombustible = litrosCombustible * gasPrice;
        const costoDesgaste = (totalCalculatedDistanceKm * vehicle.costos.desgastePorKm) * roadFactor.desgaste;
        const costoChofer = vehicle.costos.viaticosChoferFueraPorDia * numDays;
        
        const costoRentaAjustada = costoRenta * clientFactor.factor;
        const baseSubtotal = costoRentaAjustada + costoCombustible + costoDesgaste + costoChofer;
        
        const subtotalAjustado = baseSubtotal + initialCostoPeaje + initialCostoExtra;
        const tax = subtotalAjustado * 0.16;
        const totalConIva = subtotalAjustado + tax;
        
        const totalSinDescuento = totalConIva / 0.95;

        const descuentoMonto = initialAplicarDescuento ? totalSinDescuento * 0.10 : 0;
        const total = totalSinDescuento - descuentoMonto;
        
        const destinationArrivalDateTime = itineraryLegs[0].arrivalTime;
        const originArrivalDateTime = itineraryLegs[1].arrivalTime;

        const resultData: QuoteResult = {
            isItinerary: false,
            itinerary: itineraryLegs,
            origin: data.origin,
            destination: data.destination,
            people: data.people,
            baseSubtotal,
            costoRenta,
            costoCombustible,
            costoDesgaste,
            costoChofer,
            costoCasetas: initialCostoPeaje,
            costoExtra: initialCostoExtra,
            subtotal: subtotalAjustado,
            ajusteClienteFactor: clientFactor.factor,
            subtotalAjustado,
            tax,
            totalSinDescuento,
            descuentoMonto,
            total,
            vehicleName: vehicle.nombreComercial,
            realDistanceKm: apiDistanceKm,
            totalDistanceKm: totalCalculatedDistanceKm,
            tripDurationDays: numDays,
            oneWayTravelHours: oneWayDurationSeconds / 3600,
            departureDateTime: data.departureDateTime,
            returnDateTime: data.returnDateTime,
            destinationArrivalDateTime,
            originArrivalDateTime,
            tipoCliente: initialTipoCliente,
            aplicarDescuento: initialAplicarDescuento,
            vehicleRendimiento: vehicle.costos.rendimientoKmLitro,
            vehicleDesgaste: vehicle.costos.desgastePorKm,
            roadFactorCombustible: roadFactor.combustible,
            roadFactorDesgaste: roadFactor.desgaste,
            precioCombustible: gasPrice,
        };

        onQuoteCalculated(resultData);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error al calcular la cotización.";
      console.error("Error calculating quote:", err);
      setError(errorMessage.replace(/\[.*?\]\s*/, ''));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleCalculateQuote)} className="space-y-4">
        <div className="space-y-4">
            <FormField
              control={form.control}
              name="origin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origen</FormLabel>
                    <FormControl>
                      <AutocompleteInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="Escriba el origen..."
                        isLoaded={isMapsApiLoaded}
                      />
                    </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destino</FormLabel>
                      <FormControl>
                          <AutocompleteInput
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="Escriba el destino..."
                            isLoaded={isMapsApiLoaded}
                          />
                      </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
            />
        </div>
        
        <div className="pt-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <FormField
              control={form.control}
              name="people"
              render={({ field }) => (
              <FormItem>
                  <FormLabel>Personas</FormLabel>
                  <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <FormControl>
                      <Input type="number" min="1" {...field} className="pl-10" />
                  </FormControl>
                  </div>
                  <FormMessage />
              </FormItem>
              )}
          />
           <FormField
            control={form.control}
            name="tipoCamino"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Camino</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Seleccione un tipo..." /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {roadTypeFactors.map(factor => (
                      <SelectItem key={factor.id} value={factor.id}>{factor.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Controller
                control={form.control}
                name="departureDateTime"
                render={({ field, fieldState }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Salida</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "PPP, HH:mm", { locale: es }) : <span>Seleccione fecha y hora</span>}
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                                if (date) {
                                    const timeString = field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, 'HH:mm') : '09:00';
                                    const newDate = combineDateAndTime(date, timeString);
                                    if (newDate instanceof Date && !isNaN(newDate.getTime())) {
                                        field.onChange(newDate);
                                    }
                                }
                            }}
                            initialFocus
                            locale={es}
                            fixedWeeks
                            disabled={{ before: new Date() }}
                        />
                        <div className="p-3 border-t border-border">
                            <Input 
                                type="time" 
                                value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "HH:mm") : ""} 
                                onChange={(e) => {
                                    if (field.value) {
                                        const newDate = combineDateAndTime(field.value, e.target.value);
                                        if (newDate instanceof Date && !isNaN(newDate.getTime())) {
                                            field.onChange(newDate);
                                        }
                                    }
                                }} 
                            />
                        </div>
                        </PopoverContent>
                    </Popover>
                    <FormMessage>{fieldState.error?.message}</FormMessage>
                    </FormItem>
                )}
                />
                <Controller
                    control={form.control}
                    name="returnDateTime"
                    render={({ field, fieldState }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Regreso</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "PPP, HH:mm", { locale: es }) : <span>Seleccione fecha y hora</span>}
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => {
                                    if (date) {
                                        const timeString = field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, 'HH:mm') : '18:00';
                                        const newDate = combineDateAndTime(date, timeString);
                                        if (newDate instanceof Date && !isNaN(newDate.getTime())) {
                                            field.onChange(newDate);
                                        }
                                    }
                                }}
                                initialFocus
                                defaultMonth={departureDate}
                                locale={es}
                                fixedWeeks
                                disabled={{ before: departureDate || new Date() }}
                            />
                            <div className="p-3 border-t border-border">
                                <Input 
                                    type="time" 
                                    value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "HH:mm") : ""} 
                                    onChange={(e) => {
                                        if (field.value) {
                                            const newDate = combineDateAndTime(field.value, e.target.value);
                                            if (newDate instanceof Date && !isNaN(newDate.getTime())) {
                                                field.onChange(newDate);
                                            }
                                        }
                                    }} 
                                />
                            </div>
                            </PopoverContent>
                        </Popover>
                        <FormMessage>{fieldState.error?.message}</FormMessage>
                        </FormItem>
                    )}
                />
        </div>
        
        {error && <p className="mt-4 text-center text-sm font-medium text-destructive">{error}</p>}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg py-6 font-headline font-bold !mt-8"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          ) : (
            <Calculator className="mr-2 h-6 w-6" />
          )}
          {isLoading ? "Calculando..." : "Calcular Cotización"}
        </Button>
      </form>
    </Form>
  );
});
QuoteForm.displayName = "QuoteForm";
