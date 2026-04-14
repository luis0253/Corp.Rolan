
"use client";

import { useEffect, useImperativeHandle, forwardRef, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import type { QuoteResult, Vehicle, ItineraryLeg, AdvancedQuoteFormData as AdvancedQuoteFormValues } from '@/types';
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
import { Calculator, Calendar as CalendarIcon, Loader2, PlusCircle, Trash2, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import AutocompleteInput from "./autocomplete-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const functions = getFunctions(app, 'us-central1');
const getDistanceFunction = httpsCallable(functions, 'getDistance');

type DistanceResultData = {
    roundTripDistanceKm: number;
    roundTripDurationSeconds?: number;
    routeDescription?: string;
};

const stopSchema = z.object({
  destination: z.string().min(3, { message: "El destino es requerido." }),
  departureDateTime: z.date({ required_error: "Se requiere fecha de salida." }),
  tipoCamino: z.string({ required_error: "Debe seleccionar un tipo de camino." }),
});

const advancedFormSchema = z.object({
  origin: z.string().min(3, { message: "El origen debe tener al menos 3 caracteres." }),
  departureDateTime: z.date({ required_error: "Se requiere una fecha y hora de salida." }),
  people: z.coerce.number().int().min(1, { message: "Debe haber al menos 1 pasajero." }),
  stops: z.array(stopSchema).min(1, { message: "Debe agregar al menos un destino." }),
}).refine(data => {
    if (!(data.departureDateTime instanceof Date)) return false;
    if (data.stops.length > 0) {
        const firstStop = data.stops[0];
        if (!(firstStop.departureDateTime instanceof Date) || firstStop.departureDateTime <= data.departureDateTime) {
            return false;
        }
    }
    for (let i = 1; i < data.stops.length; i++) {
        const prevStop = data.stops[i-1];
        const currentStop = data.stops[i];
         if (!(prevStop.departureDateTime instanceof Date) || !(currentStop.departureDateTime instanceof Date)) {
            return false;
        }
        if (currentStop.departureDateTime <= prevStop.departureDateTime) {
            return false;
        }
    }
    return true;
}, {
    message: "Las fechas y horas de salida del itinerario deben ser secuenciales y lógicas.",
    path: ["stops"],
});

interface AdvancedQuoteFormProps {
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

export const AdvancedQuoteForm = forwardRef<any, AdvancedQuoteFormProps>(({ onQuoteCalculated, onCalculationStart, isMapsApiLoaded }, ref) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<AdvancedQuoteFormValues>({
    resolver: zodResolver(advancedFormSchema),
    defaultValues: {
      origin: "Oaxaca de Juárez, Oaxaca",
      departureDateTime: new Date(new Date().setHours(9, 0, 0, 0)),
      people: 1,
      stops: [],
    },
  });

  useImperativeHandle(ref, () => ({
    reset(values?: AdvancedQuoteFormValues) {
      form.reset(values);
    }
  }));

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "stops",
  });

  const addNewStop = () => {
    const lastStop = fields.length > 0 ? form.getValues().stops[fields.length - 1] : null;
    let newDeparture = new Date();
    
    if (lastStop && lastStop.departureDateTime) {
        newDeparture = new Date(lastStop.departureDateTime.getTime() + 24 * 60 * 60 * 1000); // 1 day after last departure
    } else {
        const originDeparture = form.getValues('departureDateTime');
        newDeparture = new Date(originDeparture.getTime() + 24 * 60 * 60 * 1000);
    }
    
    append({
        destination: "",
        departureDateTime: newDeparture,
        tipoCamino: "pista",
    });
  }
  
  const originDepartureDate = form.watch("departureDateTime");
  const stops = form.watch("stops");

  const isAtBase = (origin: string): boolean => {
    if (!origin) return false;
    const normalized = origin.trim().toLowerCase();
    const parts = normalized.split(',');
    return parts[0].includes('oaxaca');
  };

  const handleCalculateAdvancedQuote = async (data: AdvancedQuoteFormValues) => {
    setIsLoading(true);
    onCalculationStart();
    setError(null);
    
    const locations = [data.origin, ...data.stops.map(s => s.destination), data.origin];
    const roadTypes = [...data.stops.map(s => s.tipoCamino), 'pista'];

    const vehicles = await getVehicles();
    const gasPrice = await loadGasPrice(); // Await Firestore load

    if (vehicles.length === 0) {
        setError("No hay vehículos configurados para realizar un cálculo.");
        setIsLoading(false);
        return;
    }

    try {
        let apiDistanceKm = 0;
        const itineraryLegs: ItineraryLeg[] = [];
        let totalCombustibleCost = 0;
        let totalDesgasteCost = 0;

        const legPromises = locations.slice(0, -1).map((legOrigin, i) => {
            const legDestination = locations[i + 1];
            if (!legOrigin || !legDestination) {
                throw new Error(`El itinerario tiene un origen o destino vacío en el tramo ${i + 1}.`);
            }
            if (legOrigin.trim().toLowerCase() === legDestination.trim().toLowerCase()) {
                return Promise.resolve({ data: { roundTripDistanceKm: 0, roundTripDurationSeconds: 0, routeDescription: '' } });
            }
            return getDistanceFunction({
                origin: legOrigin,
                destination: legDestination
            }) as Promise<HttpsCallableResult<DistanceResultData>>;
        });

        const legDistanceResults = await Promise.all(legPromises);
        
        const suitableVehicles = vehicles
            .filter(v => v.capacidad >= data.people)
            .sort((a, b) => a.capacidad - b.capacidad);
        
        if (suitableVehicles.length === 0) {
            throw new Error(`No se encontró un vehículo con capacidad para ${data.people} personas.`);
        }
        const vehicle = suitableVehicles[0];

        let currentDepartureTime = new Date(data.departureDateTime);

        for (let i = 0; i < legDistanceResults.length; i++) {
            const result = legDistanceResults[i];
            if (typeof result.data?.roundTripDistanceKm !== 'number') {
                throw new Error(`No se pudo calcular la ruta de un tramo del itinerario. Verifique las direcciones.`);
            }
            
            const oneWayDistance = result.data.roundTripDistanceKm / 2;
            const oneWayDurationSeconds = (result.data.roundTripDurationSeconds || 0) / 2;
            
            apiDistanceKm += oneWayDistance;

            const roadFactor = roadTypeFactors.find(f => f.id === roadTypes[i]);
            if (!roadFactor) throw new Error(`Factor de camino '${roadTypes[i]}' no encontrado.`);

            const legLitrosCombustible = (oneWayDistance / vehicle.costos.rendimientoKmLitro) * roadFactor.combustible;
            totalCombustibleCost += legLitrosCombustible * gasPrice;
            totalDesgasteCost += (oneWayDistance * vehicle.costos.desgastePorKm) * roadFactor.desgaste;
            
            const arrivalTime = new Date(currentDepartureTime.getTime() + oneWayDurationSeconds * 1000);
            
            itineraryLegs.push({
                origin: locations[i],
                destination: locations[i+1],
                distanceKm: oneWayDistance,
                durationSeconds: oneWayDurationSeconds,
                departureTime: currentDepartureTime,
                arrivalTime: arrivalTime,
                roadFactorCombustible: roadFactor.combustible,
                roadFactorDesgaste: roadFactor.desgaste,
            });

            if (i < data.stops.length) {
                currentDepartureTime = new Date(data.stops[i].departureDateTime);
            } else {
                 currentDepartureTime = arrivalTime;
            }
        }
        
        if (!isAtBase(data.origin)) {
            try {
                const baseToOriginDistanceResult = await getDistanceFunction({
                    origin: COMPANY_BASE,
                    destination: data.origin,
                }) as HttpsCallableResult<DistanceResultData>;

                if (baseToOriginDistanceResult.data?.roundTripDistanceKm) {
                    const deadheadDistance = baseToOriginDistanceResult.data.roundTripDistanceKm;
                    apiDistanceKm += deadheadDistance;

                    const deadheadRoadFactor = roadTypeFactors.find(f => f.id === 'pista');
                    if(deadheadRoadFactor){
                        const deadheadLitros = (deadheadDistance / vehicle.costos.rendimientoKmLitro) * deadheadRoadFactor.combustible;
                        totalCombustibleCost += deadheadLitros * gasPrice;
                        totalDesgasteCost += (deadheadDistance * vehicle.costos.desgastePorKm) * deadheadRoadFactor.desgaste;
                    }
                }
            } catch (e) {
                console.warn(`Could not calculate distance from base to origin (Origin: "${data.origin}").`, e);
            }
        }
        
        const overallDepartureDateTime = new Date(data.departureDateTime);
        const finalLeg = itineraryLegs[itineraryLegs.length - 1];
        const overallReturnDateTime = new Date(finalLeg.arrivalTime);
        
        // LOGIC: Calendary days. 
        const startDay = new Date(overallDepartureDateTime);
        startDay.setHours(0, 0, 0, 0);
        const endDay = new Date(overallReturnDateTime);
        endDay.setHours(0, 0, 0, 0);
        const diffInMs = endDay.getTime() - startDay.getTime();
        const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24)) + 1;
        
        const numDays = Math.max(1, diffInDays);

        const additionalKmsForDays = (Math.ceil(numDays) - 1) * 50;
        const totalCalculatedDistanceKm = apiDistanceKm + additionalKmsForDays;

        const additionalRoadFactor = roadTypeFactors.find(f => f.id === 'pista');
        if (additionalRoadFactor && additionalKmsForDays > 0) {
           const additionalLitros = (additionalKmsForDays / vehicle.costos.rendimientoKmLitro) * additionalRoadFactor.combustible;
           totalCombustibleCost += additionalLitros * gasPrice;
           totalDesgasteCost += (additionalKmsForDays * vehicle.costos.desgastePorKm) * additionalRoadFactor.desgaste;
        }

        const initialTipoCliente = 'tipo1';
        const initialCostoPeaje = 0;
        const initialCostoExtra = 0;
        const initialAplicarDescuento = false;
        
        const clientFactor = clientTypeFactors.find(f => f.id === initialTipoCliente);
        if (!clientFactor) throw new Error("Factor de cliente inicial no encontrado.");

        const costoRenta = vehicle.costos.rentaDiaria * numDays;
        const costoChofer = vehicle.costos.viaticosChoferFueraPorDia * numDays;
        
        const costoRentaAjustada = costoRenta * clientFactor.factor;
        const baseSubtotal = costoRentaAjustada + totalCombustibleCost + totalDesgasteCost + costoChofer;
        
        const subtotalAjustado = baseSubtotal + initialCostoPeaje + initialCostoExtra;
        const tax = subtotalAjustado * 0.16;
        const totalConIva = subtotalAjustado + tax;
        const totalSinDescuento = totalConIva / 0.95;

        const descuentoMonto = initialAplicarDescuento ? totalSinDescuento * 0.10 : 0;
        const total = totalSinDescuento - descuentoMonto;

        const totalTravelDurationSeconds = itineraryLegs.reduce((acc, leg) => acc + leg.durationSeconds, 0);

        const resultData: QuoteResult = {
            isItinerary: true,
            itinerary: itineraryLegs,
            origin: data.origin,
            destination: data.stops.map(s => s.destination).join(' / '),
            people: data.people,
            baseSubtotal,
            costoRenta,
            costoCombustible: totalCombustibleCost,
            costoDesgaste: totalDesgasteCost,
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
            oneWayTravelHours: totalTravelDurationSeconds / 3600,
            departureDateTime: overallDepartureDateTime,
            returnDateTime: overallReturnDateTime,
            destinationArrivalDateTime: new Date(),
            originArrivalDateTime: overallReturnDateTime,
            tipoCliente: initialTipoCliente,
            aplicarDescuento: initialAplicarDescuento,
            vehicleRendimiento: vehicle.costos.rendimientoKmLitro,
            vehicleDesgaste: vehicle.costos.desgastePorKm,
            roadFactorCombustible: 1,
            roadFactorDesgaste: 1,
            precioCombustible: gasPrice,
        };

        onQuoteCalculated(resultData);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error al calcular el itinerario.";
      console.error("Error calculating advanced quote:", err);
      setError(errorMessage.replace(/\[.*?\]\s*/, ''));
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleCalculateAdvancedQuote)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="people" render={({ field }) => (
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
            )}/>
        </div>
        
        <Separator />

        <div className="space-y-4">
            <FormLabel>Itinerario</FormLabel>
            
            <Card className="p-4 relative bg-muted/30">
                 <CardContent className="p-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="origin" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Punto de Partida (Origen)</FormLabel>
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
                    )}/>
                     <Controller control={form.control} name="departureDateTime" render={({ field, fieldState }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Salida del Origen</FormLabel>
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
                                                field.onChange(combineDateAndTime(date, timeString));
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
                                            onChange={e => { if (field.value) field.onChange(combineDateAndTime(field.value, e.target.value))}}
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                            <FormMessage>{fieldState.error?.message}</FormMessage>
                        </FormItem>
                   )} />
                </CardContent>
            </Card>

            {fields.map((item, index) => {
                const previousDeparture = index === 0 ? originDepartureDate : stops[index - 1]?.departureDateTime;
                return (
                    <Card key={item.id} className="p-4 relative bg-muted/30">
                         <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Eliminar parada</span>
                        </Button>
                        <CardContent className="p-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <FormField control={form.control} name={`stops.${index}.destination`} render={({ field }) => (
                               <FormItem>
                                    <FormLabel>Destino {index + 1}</FormLabel>
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
                           )} />
                           
                           <Controller control={form.control} name={`stops.${index}.departureDateTime`} render={({ field, fieldState }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Salida del Destino {index + 1}</FormLabel>
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
                                                defaultMonth={field.value} 
                                                onSelect={(date) => {
                                                    if (date) {
                                                        const timeString = field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, 'HH:mm') : '18:00';
                                                        field.onChange(combineDateAndTime(date, timeString));
                                                    }
                                                }}
                                                initialFocus 
                                                locale={es} 
                                                fixedWeeks 
                                                disabled={{ before: previousDeparture || new Date() }}
                                            />
                                            <div className="p-3 border-t border-border">
                                                <Input 
                                                    type="time" 
                                                    value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "HH:mm") : ""} 
                                                    onChange={e => { if (field.value) field.onChange(combineDateAndTime(field.value, e.target.value))}}
                                                />
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage>{fieldState.error?.message}</FormMessage>
                                </FormItem>
                           )} />
                        </CardContent>
                         <div className="pt-4">
                            <FormField
                                control={form.control}
                                name={`stops.${index}.tipoCamino`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Camino (Tramo {index + 1})</FormLabel>
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
                    </Card>
                )
            })}
             <FormMessage>{form.formState.errors.stops?.root?.message || form.formState.errors.stops?.message}</FormMessage>
             {error && <p className="mt-4 text-center text-sm font-medium text-destructive">{error}</p>}
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={addNewStop}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Agregar Destino
        </Button>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg py-6 font-headline font-bold"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          ) : (
            <Calculator className="mr-2 h-6 w-6" />
          )}
          {isLoading ? "Calculando..." : "Calcular Cotización de Itinerario"}
        </Button>
      </form>
    </Form>
  );
});
AdvancedQuoteForm.displayName = 'AdvancedQuoteForm';
