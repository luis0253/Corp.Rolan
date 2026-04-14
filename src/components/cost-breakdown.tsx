
"use client";

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { QuoteResult } from '@/types';
import { clientTypeFactors } from '@/lib/pricing-factors';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Download, Loader2, User, Clock, ArrowRight, CalendarDays } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { generateQuotePdf } from '@/lib/pdf-generator';
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


interface CostBreakdownProps {
  result: QuoteResult | null;
  isLoading: boolean;
  setQuoteResult: React.Dispatch<React.SetStateAction<QuoteResult | null>>;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};

const formatHours = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
};

const formatLongDate = (date: Date) => format(date, "d MMM, HH:mm'h'", { locale: es });

const BreakdownItem = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div className={`flex justify-between py-2 ${className}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export function CostBreakdown({ result, isLoading, setQuoteResult }: CostBreakdownProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [clientName, setClientName] = useState('');
    const { toast } = useToast();
    
    const handleAdjustmentChange = (
      field: keyof Pick<QuoteResult, 'tipoCliente' | 'costoCasetas' | 'costoExtra' | 'aplicarDescuento' | 'totalDistanceKm' | 'tripDurationDays'>,
      value: string | number | boolean
    ) => {
        if (!result) return;

        let updatedValue: string | number | boolean | null = value;

        if (field === 'costoCasetas' || field === 'costoExtra' || field === 'totalDistanceKm' || field === 'tripDurationDays') {
            if (value === '') {
                updatedValue = null;
            } else {
                const numValue = Number(value);
                if (isNaN(numValue)) return; // Prevent non-numeric values
                updatedValue = numValue;
            }
        }
        
        const newResultState = { ...result, [field]: updatedValue };

        // Recalculate everything based on the new potential state
        const costoPeaje = newResultState.costoCasetas || 0;
        const costoExtra = newResultState.costoExtra || 0;
        const editableDistanceKm = newResultState.totalDistanceKm || 0;
        const tripDurationDays = newResultState.tripDurationDays || 1;
        
        let costoCombustible = newResultState.costoCombustible;
        let costoDesgaste = newResultState.costoDesgaste;
        let costoRenta = newResultState.costoRenta;
        let costoChofer = newResultState.costoChofer;

        // Recalculate distance-based costs if totalDistanceKm is changed
        if (field === 'totalDistanceKm' && newResultState.vehicleRendimiento > 0) {
            costoCombustible = (editableDistanceKm / newResultState.vehicleRendimiento) * newResultState.roadFactorCombustible * newResultState.precioCombustible;
            costoDesgaste = (editableDistanceKm * newResultState.vehicleDesgaste) * newResultState.roadFactorDesgaste;
        }

        // Recalculate duration-based costs if tripDurationDays is changed
        if(field === 'tripDurationDays' && result.vehicleName) {
            const additionalKmsForDays = (Math.ceil(tripDurationDays) - 1) * 50;
            const newTotalDistance = result.realDistanceKm + additionalKmsForDays;

            costoCombustible = (newTotalDistance / newResultState.vehicleRendimiento) * newResultState.roadFactorCombustible * newResultState.precioCombustible;
            costoDesgaste = (newTotalDistance * newResultState.vehicleDesgaste) * newResultState.roadFactorDesgaste;
            
            costoRenta = (newResultState.costoRenta / (result.tripDurationDays || 1)) * tripDurationDays;
            costoChofer = (newResultState.costoChofer / (result.tripDurationDays || 1)) * tripDurationDays;
            
            newResultState.totalDistanceKm = newTotalDistance;
        }

        
        const clientFactor = clientTypeFactors.find(f => f.id === newResultState.tipoCliente);
        if (!clientFactor) return;

        const costoRentaAjustada = costoRenta * clientFactor.factor;
        const baseSubtotal = costoRentaAjustada + costoCombustible + costoChofer + costoDesgaste;

        const subtotalAjustado = baseSubtotal + costoPeaje + costoExtra;
        const tax = subtotalAjustado * 0.16;
        const totalConIva = subtotalAjustado + tax;

        // New formula: (subtotal_con_iva) / 0.95
        const totalSinDescuento = totalConIva / 0.95;

        const descuentoMonto = newResultState.aplicarDescuento ? totalSinDescuento * 0.10 : 0;
        const total = totalSinDescuento - descuentoMonto;
        
        setQuoteResult({
            ...newResultState,
            costoRenta,
            costoChofer,
            costoCombustible,
            costoDesgaste,
            baseSubtotal,
            subtotal: subtotalAjustado,
            ajusteClienteFactor: clientFactor.factor,
            subtotalAjustado,
            tax,
            totalSinDescuento,
            descuentoMonto,
            total,
        });
    };

    const handleExport = async () => {
        if (!result) return;
        if (!clientName.trim()) {
            toast({
                variant: "destructive",
                title: "Falta el nombre del cliente",
                description: "Por favor, ingrese un nombre para la cotización antes de exportar.",
            });
            return;
        }
        setIsExporting(true);
        toast({ title: "Generando PDF...", description: "Por favor espere un momento." });
        try {
            await generateQuotePdf(result, clientName);
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ 
                variant: "destructive",
                title: "Error al exportar",
                description: "No se pudo generar el PDF. Por favor, intente de nuevo."
            });
        } finally {
            setIsExporting(false);
        }
    };


    if (isLoading) {
        return (
          <Card className="bg-muted/30">
            <CardHeader>
              <Skeleton className="h-7 w-40" />
               <Skeleton className="h-4 w-52" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
              <Separator />
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-8 w-full" />
            </CardFooter>
          </Card>
        );
      }
    
      if (!result) {
        return (
          <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border-2 border-dashed bg-muted/20 p-8 text-center">
            <div>
                <p className="text-muted-foreground">Su cotización estimada aparecerá aquí una vez que complete el formulario.</p>
            </div>
          </div>
        );
      }

  const costoRentaAjustada = result.costoRenta * result.ajusteClienteFactor;

  return (
    <Card className="shadow-lg">
       <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline text-2xl">
                <CheckCircle className="text-accent h-6 w-6"/>
                <span>Cotización Estimada</span>
            </CardTitle>
            <CardDescription>
                <div className="flex flex-col space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span>Vehículo: <span className="font-medium text-foreground/90">{result.vehicleName}</span></span>
                    </div>
                     <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                        <span>KM Reales (API): <span className="font-medium text-foreground/90">{Math.round(result.realDistanceKm)} km</span></span>
                        <span className="text-muted-foreground/50 hidden sm:inline-block">•</span>
                        <span>KM Calculados (Final): <span className="font-medium text-foreground/90">{Math.round(result.totalDistanceKm || 0)} km</span></span>
                        <span className="text-muted-foreground/50 hidden sm:inline-block">•</span>
                        <span>Duración: <span className="font-medium text-foreground/90">{result.tripDurationDays} {result.tripDurationDays === 1 ? 'día' : 'días'}</span></span>
                    </div>
                </div>
            </CardDescription>
        </CardHeader>
      <CardContent>
        {/* Itinerary Section */}
         {result.itinerary && result.itinerary.length > 0 && (
            <div className="text-sm text-foreground bg-muted/40 p-3 rounded-lg mb-4 border border-dashed">
                <h4 className="font-semibold mb-2">Itinerario del Viaje</h4>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tramo</TableHead>
                            <TableHead className="text-center">Tiempo</TableHead>
                            <TableHead className="text-right">Horarios (Salida / Llegada)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {result.itinerary.map((leg, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span>{leg.origin.split(',')[0]}</span>
                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                        <span>{leg.destination.split(',')[0]}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>~{formatHours(leg.durationSeconds)}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    {formatLongDate(leg.departureTime)}<br/>
                                    {formatLongDate(leg.arrivalTime)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
         )}


        {/* Cost Breakdown Section */}
        <h4 className="font-semibold text-foreground mb-1">Desglose de Costos</h4>
        <BreakdownItem label={`Renta de unidad (${((result.ajusteClienteFactor - 1) * 100).toFixed(0)}% ajuste)`} value={formatCurrency(costoRentaAjustada)} />
        <BreakdownItem label="Combustible (Estimado)" value={formatCurrency(result.costoCombustible)} />
        <BreakdownItem label="Desgaste de unidad" value={formatCurrency(result.costoDesgaste)} />
        <BreakdownItem label="Viáticos de operador" value={formatCurrency(result.costoChofer)} />
        <BreakdownItem label="Peaje (Manual)" value={formatCurrency(result.costoCasetas || 0)} />
        {(result.costoExtra || 0) > 0 && <BreakdownItem label="Costos Extra" value={formatCurrency(result.costoExtra || 0)} />}
        <Separator className="my-2" />
        <BreakdownItem label="Subtotal" value={formatCurrency(result.subtotalAjustado)} className="font-bold"/>
        <Separator className="my-2" />
        <BreakdownItem label="IVA (16%)" value={formatCurrency(result.tax)} />
        {result.descuentoMonto > 0 && (
          <>
            <BreakdownItem label="Total sin Descuento" value={formatCurrency(result.totalSinDescuento)} />
            <BreakdownItem label="Descuento (10%)" value={`-${formatCurrency(result.descuentoMonto)}`} className="text-green-600 dark:text-green-500" />
          </>
        )}
         <Separator className="my-4" />

        {/* Adjustments Section */}
        <div className="space-y-6">
            <h3 className="text-lg font-medium font-headline">Ajustes de Cotización</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Cliente</Label>
                <Select
                  value={result.tipoCliente}
                  onValueChange={(value) => handleAdjustmentChange('tipoCliente', value)}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccione un tipo..." /></SelectTrigger>
                  <SelectContent>
                    {clientTypeFactors.map(factor => (
                      <SelectItem key={factor.id} value={factor.id}>{factor.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tripDurationDays">Duración del Viaje (Días)</Label>
                <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="tripDurationDays"
                      type="number"
                      step="0.1"
                      min="0"
                      value={result.tripDurationDays ?? ''}
                      onChange={(e) => handleAdjustmentChange('tripDurationDays', e.target.value)}
                      className="pl-10"
                    />
                </div>
              </div>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label>Costo de Peaje (Manual)</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    placeholder="0" 
                    value={result.costoCasetas ?? ''} 
                    onChange={(e) => handleAdjustmentChange('costoCasetas', e.target.value)}
                  />
                </div>
               <div className="space-y-2">
                  <Label>Costo Extra</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    placeholder="0" 
                    value={result.costoExtra ?? ''} 
                    onChange={(e) => handleAdjustmentChange('costoExtra', e.target.value)}
                  />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="totalDistanceKm">Kilometraje Total (Editable)</Label>
                <Input
                  id="totalDistanceKm"
                  type="number"
                  min="0"
                  value={result.totalDistanceKm ?? ''}
                  onChange={(e) => handleAdjustmentChange('totalDistanceKm', e.target.value)}
                />
            </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Aplicar Descuento del 10%</Label>
                </div>
                <Switch 
                  checked={result.aplicarDescuento} 
                  onCheckedChange={(checked) => handleAdjustmentChange('aplicarDescuento', checked)} 
                />
              </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-4 rounded-b-lg bg-muted p-4 mt-6">
        <div className="flex justify-between text-lg font-bold">
          <span>Total:</span>
          <span className="font-headline text-2xl">{formatCurrency(result.total)}</span>
        </div>
        <div className="space-y-2">
            <Label htmlFor="clientName" className="font-medium">Nombre del Cliente para PDF</Label>
            <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    id="clientName" 
                    placeholder="Escriba el nombre completo..."
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="pl-10"
                />
            </div>
        </div>
        <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExporting ? "Generando PDF..." : "Exportar a PDF"}
        </Button>
        <p className="text-xs text-center text-muted-foreground">*Esta es una cotización estimada. Los costos pueden variar.</p>
      </CardFooter>
    </Card>
  );
}
