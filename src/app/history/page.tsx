"use client";

import { useEffect, useState } from 'react';
import { getQuoteHistory } from '@/lib/quote-history';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, ArrowRight, Clock, Loader2, User, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { clientTypeFactors } from '@/lib/pricing-factors';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { Copy } from 'lucide-react';

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

const formatHours = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
};

const formatLongDate = (date: Date | null) =>
    date ? format(date, "d MMM, HH:mm'h'", { locale: es }) : '—';

const BreakdownItem = ({ label, value, className }: { label: string; value: string; className?: string }) => (
    <div className={`flex justify-between py-2 ${className}`}>
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
    </div>
);

function QuoteCard({ quote }: { quote: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    const handleReusar = (e: React.MouseEvent) => {
        e.stopPropagation();
        localStorage.setItem('quote_prefill', JSON.stringify({
            ...quote,
            departureDateTime: quote.departureDateTime?.toISOString?.() ?? null,
            returnDateTime: quote.returnDateTime?.toISOString?.() ?? null,
            destinationArrivalDateTime: quote.destinationArrivalDateTime?.toISOString?.() ?? null,
            originArrivalDateTime: quote.originArrivalDateTime?.toISOString?.() ?? null,
            itinerary: quote.itinerary?.map((leg: any) => ({
                ...leg,
                departureTime: leg.departureTime?.toISOString?.() ?? null,
                arrivalTime: leg.arrivalTime?.toISOString?.() ?? null,
            })) ?? [],
        }));
        router.push('/');
    };
    const clientFactor = clientTypeFactors.find(f => f.id === quote.tipoCliente);
    const costoRentaAjustada = quote.costoRenta * (quote.ajusteClienteFactor || 1);

    return (
        <Card className="shadow-md overflow-hidden">
            {/* Header siempre visible - clickeable para colapsar */}
            <CardHeader
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <User className="h-4 w-4 text-accent shrink-0" />
                        <div className="min-w-0">
                            <CardTitle className="text-base font-semibold truncate">{quote.clientName}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                                {quote.origin?.split(',')[0]} → {quote.destination?.split(',')[0]}
                                <span className="mx-2">·</span>
                                {quote.createdAt?.toDate ? format(quote.createdAt.toDate(), "d MMM yyyy, HH:mm", { locale: es }) : '—'}
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="font-headline font-bold text-lg text-primary">{formatCurrency(quote.total || 0)}</span>
                        <Button size="sm" variant="outline" className="shrink-0" onClick={handleReusar}>
                            <Copy className="h-3 w-3 mr-1" />
                            Reusar
                        </Button>
                        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                </div>
            </CardHeader>

            {/* Contenido colapsable */}
            {isOpen && (
                <CardContent className="space-y-4 pt-0">
                    <Separator />

                    {/* Info rápida */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>Vehículo: <span className="text-foreground font-medium">{quote.vehicleName}</span></span>
                        <span>KM reales: <span className="text-foreground font-medium">{Math.round(quote.realDistanceKm || 0)} km</span></span>
                        <span>KM total: <span className="text-foreground font-medium">{Math.round(quote.totalDistanceKm || 0)} km</span></span>
                        <span>Duración: <span className="text-foreground font-medium">{quote.tripDurationDays} {quote.tripDurationDays === 1 ? 'día' : 'días'}</span></span>
                        <span>Personas: <span className="text-foreground font-medium">{quote.people}</span></span>
                    </div>

                    {/* Itinerario */}
                    {quote.itinerary?.length > 0 && (
                        <div className="text-sm bg-muted/40 p-3 rounded-lg border border-dashed">
                            <h4 className="font-semibold mb-2">Itinerario</h4>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tramo</TableHead>
                                        <TableHead className="text-center">Tiempo</TableHead>
                                        <TableHead className="text-right">Salida / Llegada</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {quote.itinerary.map((leg: any, i: number) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <span>{leg.origin?.split(',')[0]}</span>
                                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                    <span>{leg.destination?.split(',')[0]}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    ~{formatHours(leg.durationSeconds || 0)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-xs">
                                                {formatLongDate(leg.departureTime)}<br />
                                                {formatLongDate(leg.arrivalTime)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Desglose */}
                    <h4 className="font-semibold">Desglose de Costos</h4>
                    <BreakdownItem label={`Renta (${(((quote.ajusteClienteFactor || 1) - 1) * 100).toFixed(0)}% ajuste)`} value={formatCurrency(costoRentaAjustada)} />
                    <BreakdownItem label="Combustible" value={formatCurrency(quote.costoCombustible || 0)} />
                    <BreakdownItem label="Desgaste" value={formatCurrency(quote.costoDesgaste || 0)} />
                    <BreakdownItem label="Viáticos operador" value={formatCurrency(quote.costoChofer || 0)} />
                    <BreakdownItem label="Peaje" value={formatCurrency(quote.costoCasetas || 0)} />
                    {(quote.costoExtra || 0) > 0 && <BreakdownItem label="Costos Extra" value={formatCurrency(quote.costoExtra)} />}
                    <Separator />
                    <BreakdownItem label="Subtotal" value={formatCurrency(quote.subtotalAjustado || 0)} className="font-bold" />
                    <Separator />
                    <BreakdownItem label="IVA (16%)" value={formatCurrency(quote.tax || 0)} />
                    {(quote.descuentoMonto || 0) > 0 && (
                        <>
                            <BreakdownItem label="Total sin Descuento" value={formatCurrency(quote.totalSinDescuento || 0)} />
                            <BreakdownItem label="Descuento (10%)" value={`-${formatCurrency(quote.descuentoMonto)}`} className="text-green-600 dark:text-green-500" />
                        </>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold bg-muted rounded-lg p-3">
                        <span>Total:</span>
                        <span className="font-headline text-2xl text-primary">{formatCurrency(quote.total || 0)}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-muted-foreground pt-1">
                        <span>Tipo cliente: <span className="text-foreground font-medium">{clientFactor?.nombre || quote.tipoCliente}</span></span>
                        <span>Combustible: <span className="text-foreground font-medium">{formatCurrency(quote.precioCombustible || 0)}/L</span></span>
                        <span>Rendimiento: <span className="text-foreground font-medium">{quote.vehicleRendimiento} km/L</span></span>
                        <span>Descuento: <span className="text-foreground font-medium">{quote.aplicarDescuento ? 'Sí' : 'No'}</span></span>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

export default function HistoryPage() {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        getQuoteHistory().then(data => {
            setQuotes(data);
            setIsLoading(false);
        });
    }, []);

    const filtered = quotes.filter(q => {
        const term = search.toLowerCase();
        return (
            q.clientName?.toLowerCase().includes(term) ||
            q.origin?.toLowerCase().includes(term) ||
            q.destination?.toLowerCase().includes(term) ||
            q.vehicleName?.toLowerCase().includes(term)
        );
    });

    return (
        <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-3xl space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
                    </Link>
                    <h1 className="font-headline text-3xl font-bold text-primary">Historial de Cotizaciones</h1>
                </div>

                {/* Buscador */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por cliente, origen, destino o vehículo..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex justify-center items-center min-h-[200px] rounded-lg border-2 border-dashed bg-muted/20">
                        <p className="text-muted-foreground">
                            {search ? 'No se encontraron resultados.' : 'No hay cotizaciones guardadas aún.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'cotización' : 'cotizaciones'}</p>
                        {filtered.map(q => <QuoteCard key={q.id} quote={q} />)}
                    </div>
                )}
            </div>
        </main>
    );
}