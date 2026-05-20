
"use client";

import { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { Settings, MapPin, UploadCloud, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import * as mammoth from 'mammoth';

import type { QuoteResult, ExtractedQuoteInfoOutput } from '@/types';
import { loadGasPrice } from '@/lib/app-config';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { QuoteForm } from '@/components/quote-form';
import { AdvancedQuoteForm } from '@/components/advanced-quote-form';
import { CostBreakdown } from '@/components/cost-breakdown';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { extractQuoteInfo } from '@/ai/flows/extract-quote-flow';
import { History } from 'lucide-react';

const functions = getFunctions(app, 'us-central1');
const getGoogleMapsApiKeyFunction = httpsCallable(functions, 'getGoogleMapsApiKey');

export const COMPANY_BASE = "Oaxaca de Juárez, Oaxaca";

export default function Home() {
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState("simple");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isMapsApiLoaded, setIsMapsApiLoaded] = useState(false);

  const simpleFormRef = useRef<any>(null);
  const advancedFormRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
    // Pre-load gas price into cache
    loadGasPrice();

    const loadMapsAPI = async () => {
      try {
        const result = await getGoogleMapsApiKeyFunction();
        const key = (result.data as { apiKey: string }).apiKey;
        if (key) {
          const loader = new Loader({
            apiKey: key,
            version: "weekly",
            libraries: ["places"],
          });
          await loader.load();
          setIsMapsApiLoaded(true);
        } else {
          throw new Error("La clave de API de mapas para el cliente no fue devuelta por el servidor.");
        }
      } catch (err) {
        console.error("Failed to load Google Maps API key or script:", err);
        toast({
          variant: "destructive",
          title: "Error de Configuración",
          description: "No se pudo cargar la API de Google Maps. El autocompletado de direcciones no funcionará.",
        });
      }
    };
    loadMapsAPI();
  }, [toast]);

  const resetState = () => {
    if (quoteResult) {
      setQuoteResult(null);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast({ title: "Procesando documento...", description: "La IA está extrayendo la información del viaje." });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { value: documentText } = await mammoth.extractRawText({ arrayBuffer });

      const extractedData = await extractQuoteInfo({ documentText });

      if (!extractedData) {
        throw new Error("La IA no pudo extraer información del documento.");
      }

      simpleFormRef.current?.reset();
      advancedFormRef.current?.reset();

      if (extractedData.isItinerary && extractedData.stops && extractedData.stops.length > 0) {
        setActiveTab("advanced");
        const transformedStops = extractedData.stops.map(stop => ({
          destination: stop.destination || '',
          departureDateTime: stop.departureDateTime ? new Date(stop.departureDateTime) : new Date(),
          tipoCamino: 'pista',
        }));

        advancedFormRef.current?.reset({
          origin: extractedData.origin || COMPANY_BASE,
          departureDateTime: extractedData.departureDateTime ? new Date(extractedData.departureDateTime) : new Date(),
          people: extractedData.people || 1,
          stops: transformedStops,
        });

      } else {
        setActiveTab("simple");
        simpleFormRef.current?.reset({
          origin: extractedData.origin || COMPANY_BASE,
          destination: extractedData.destination || '',
          people: extractedData.people || 1,
          departureDateTime: extractedData.departureDateTime ? new Date(extractedData.departureDateTime) : new Date(),
          returnDateTime: extractedData.returnDateTime ? new Date(extractedData.returnDateTime) : new Date(),
          tipoCamino: 'pista',
        });
      }

      toast({ title: "¡Éxito!", description: "El formulario ha sido rellenado con los datos del documento." });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido durante la importación.";
      console.error("File import error:", err);
      toast({
        variant: "destructive",
        title: "Error de Importación",
        description: errorMessage,
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleQuoteCalculated = (result: QuoteResult) => {
    setQuoteResult(result);
    setIsLoading(false);
  }

  return (
    <>
      <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 lg:p-12">
        <div className="relative w-full max-w-2xl space-y-8">
          <div className="absolute top-0 right-0">
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Configuración</span>
              </Button>
            </Link>
            <Link href="/history">
              <Button variant="ghost" size="icon">
                <History className="h-5 w-5" />
                <span className="sr-only">Historial</span>
              </Button>
            </Link>
          </div>
          <div className="text-center">
            <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-primary pt-10">
              Rolan Transporte
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Calculadora de Costos de Transporte
            </p>
          </div>

          <Card className="w-full shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline text-2xl">
                <MapPin className="text-accent h-6 w-6" />
                <span>Detalles del Viaje</span>
              </CardTitle>
              <CardDescription>
                Seleccione el tipo de viaje, complete los detalles u importe un documento para obtener una cotización.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div onChange={resetState} onKeyDown={resetState}>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="simple">Viaje Simple</TabsTrigger>
                    <TabsTrigger value="advanced">Itinerario Múltiple</TabsTrigger>
                  </TabsList>
                  {isClient ? (
                    <>
                      <TabsContent value="simple" className="pt-6">
                        <QuoteForm
                          ref={simpleFormRef}
                          onQuoteCalculated={handleQuoteCalculated}
                          isMapsApiLoaded={isMapsApiLoaded}
                          onCalculationStart={() => {
                            setIsLoading(true);
                            setQuoteResult(null);
                          }}
                        />
                      </TabsContent>
                      <TabsContent value="advanced" className="pt-6">
                        <AdvancedQuoteForm
                          ref={advancedFormRef}
                          onQuoteCalculated={handleQuoteCalculated}
                          isMapsApiLoaded={isMapsApiLoaded}
                          onCalculationStart={() => {
                            setIsLoading(true);
                            setQuoteResult(null);
                          }}
                        />
                      </TabsContent>
                    </>
                  ) : (
                    <div className="pt-6 space-y-6">
                      <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                      <Skeleton className="h-12 w-full" />
                    </div>
                  )}
                </Tabs>
              </div>

              <Separator className="my-6" />

              <div className="text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".docx"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="mr-2 h-4 w-4" />
                  )}
                  {isImporting ? 'Importando...' : 'Importar desde Archivo (.docx)'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          <div className="w-full">
            <CostBreakdown
              result={quoteResult}
              isLoading={isLoading}
              setQuoteResult={setQuoteResult}
            />
          </div>

        </div>
      </main>
    </>
  );
}
