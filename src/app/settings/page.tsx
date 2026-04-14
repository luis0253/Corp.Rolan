
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Palette, PlusCircle, Trash2, Undo, FileText, ClipboardCopy, Fuel, Cog } from "lucide-react";
import { useTheme } from "next-themes";

import { useToast } from "@/hooks/use-toast";
import { getVehicles, saveVehicles, defaultVehicles } from "@/lib/vehicle-data";
import { loadGasPrice, saveGasPrice, loadFontSize, saveFontSize } from "@/lib/app-config";
import type { Vehicle, VehicleCosts, FontSize } from "@/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsPage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const { toast } = useToast();
    const { theme, setTheme } = useTheme();
    const [fontSize, setFontSize] = useState<FontSize>('md');
    const [isClient, setIsClient] = useState(false);
    const [exportedJson, setExportedJson] = useState('');
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [gasPrice, setGasPrice] = useState<string>('');

    const fetchVehicles = useCallback(async () => {
        setIsLoading(true);
        try {
            const vehiclesData = await getVehicles();
            setVehicles(vehiclesData);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "No se pudieron cargar los datos de los vehículos.";
            console.error("Error fetching vehicles:", error);
            toast({
                variant: "destructive",
                title: "Error al cargar datos",
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        setIsClient(true);
        const storedSize = loadFontSize();
        if (storedSize) {
            handleFontSizeChange(storedSize, false);
        }
        
        // Load gas price async
        loadGasPrice().then(price => setGasPrice(price.toString()));
        
        fetchVehicles();
    }, [fetchVehicles]);
    
    const handleDetailChange = (
        vehicleId: string,
        field: 'nombreComercial' | 'capacidad' | 'quantity',
        value: string
    ) => {
        setVehicles(prevVehicles =>
            prevVehicles.map(v => {
                if (v.id === vehicleId) {
                    const parsedValue = (field === 'capacidad' || field === 'quantity') 
                        ? (value === '' ? 0 : parseInt(value, 10)) 
                        : value;
                    if ((field === 'capacidad' || field === 'quantity') && isNaN(parsedValue as number)) return v;
                    return { ...v, [field]: parsedValue };
                }
                return v;
            })
        );
    };

    const handleCostChange = (
        vehicleId: string,
        costKey: keyof VehicleCosts,
        value: string
    ) => {
        const numericValue = value === '' ? 0 : parseFloat(value);
        if (isNaN(numericValue)) return;

        setVehicles(prevVehicles =>
            prevVehicles.map(v =>
                v.id === vehicleId && v.costos
                    ? { ...v, costos: { ...v.costos, [costKey]: numericValue } }
                    : v
            )
        );
    };
    
    const handleAddVehicle = () => {
        const newVehicle: Vehicle = {
            id: `new-${Date.now()}`,
            nombreComercial: 'Nuevo Vehículo',
            capacidad: 1,
            quantity: 1,
            costos: {
                rentaDiaria: 0,
                rendimientoKmLitro: 0,
                desgastePorKm: 0,
                viaticosChoferFueraPorDia: 0,
                viaticosChoferCiudadPorDia: 0,
                sad10Horas: 0,
                sad24Horas: 0,
            },
        };
        setVehicles(prevVehicles => [...prevVehicles, newVehicle]);
    };

    const handleRemoveVehicle = (vehicleId: string) => {
        setVehicles(prevVehicles => prevVehicles.filter(v => v.id !== vehicleId));
    };

    const handleResetToDefaults = () => {
        setVehicles(defaultVehicles);
        setIsEditing(true);
        toast({
            title: "Tabla restablecida",
            description: "La lista de vehículos ha sido restaurada a los valores por defecto. Presiona 'Guardar Cambios' para hacerlo permanente.",
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save vehicles to Firestore
            await saveVehicles(vehicles);
            
            // Save gas price to Firestore
            const numericGasPrice = parseFloat(gasPrice);
            if (!isNaN(numericGasPrice) && numericGasPrice >= 0) {
                await saveGasPrice(numericGasPrice);
            }

            toast({
                title: "Guardado Permanente",
                description: "Las configuraciones se han guardado exitosamente en la base de datos.",
            });
            await fetchVehicles(); 
            setIsEditing(false); 
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "No se pudieron guardar las configuraciones en la base de datos.";
            console.error("Error saving settings:", error);
            toast({
                variant: "destructive",
                title: "Error al Guardar",
                description: errorMessage,
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleFontSizeChange = (size: FontSize, showToast = true) => {
        setFontSize(size);
        saveFontSize(size);
        if (showToast) {
            toast({ title: "Apariencia actualizada", description: "El tamaño de la fuente ha sido cambiado." });
        }
    };

    const handleGasPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Only update local state, save triggered by main button
        setGasPrice(e.target.value);
    }

    const handleExport = () => {
        setExportedJson(JSON.stringify(vehicles, null, 2));
        setIsExportDialogOpen(true);
    };

    const handleCopyToClipboard = () => {
        navigator.clipboard.writeText(exportedJson);
        toast({
            title: "Copiado",
            description: "La configuración ha sido copiada al portapapeles.",
        });
    };

    const renderSkeleton = (key: React.Key) => (
        <TableRow key={key}>
            <TableCell><Skeleton className="h-9 w-full" /></TableCell>
            <TableCell><Skeleton className="h-9 w-full" /></TableCell>
            <TableCell><Skeleton className="h-9 w-full" /></TableCell>
            {[...Array(7)].map((_, i) => (
                <TableCell key={i}><Skeleton className="h-9 w-full" /></TableCell>
            ))}
             <TableCell><Skeleton className="h-9 w-10" /></TableCell>
        </TableRow>
    );

    return (
        <main className="flex min-h-screen w-full flex-col items-center bg-background p-4 text-foreground sm:p-8 lg:p-12">
            <div className="w-full max-w-7xl space-y-8">
                <div className="mb-4">
                    <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" />
                        Volver a la calculadora
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Configuración de Vehículos y Costos</CardTitle>
                                <CardDescription>
                                   Activa el modo de edición para modificar, agregar o eliminar vehículos. Los cambios se guardarán permanentemente.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-end space-x-2 mb-4">
                                  <Label htmlFor="edit-mode-switch" className="text-sm font-medium">
                                    {isEditing ? 'Modo Edición Activado' : 'Modo Edición Desactivado'}
                                  </Label>
                                  <Switch
                                    id="edit-mode-switch"
                                    checked={isEditing}
                                    onCheckedChange={setIsEditing}
                                    aria-label="Activar modo de edición"
                                  />
                                </div>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[100px]">Cantidad</TableHead>
                                                <TableHead className="w-[220px]">Vehículo</TableHead>
                                                <TableHead className="w-[100px]">Capacidad</TableHead>
                                                <TableHead className="text-right w-[130px]">Renta Diaria<br/>(Base) ($)</TableHead>
                                                <TableHead className="text-right w-[130px]">Rendimiento<br/>(Km/L)</TableHead>
                                                <TableHead className="text-right w-[130px]">Desgaste<br/>($/Km)</TableHead>
                                                <TableHead className="text-right w-[130px]">Viáticos<br/>Fuera ($)</TableHead>
                                                <TableHead className="text-right w-[130px]">Viáticos<br/>Ciudad ($)</TableHead>
                                                <TableHead className="text-right w-[130px]">S.A.D. 10hr<br/>(Base) ($)</TableHead>
                                                <TableHead className="text-right w-[130px]">S.A.D. 24hr<br/>(Base) ($)</TableHead>
                                                <TableHead className="text-right w-[80px]">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                            [...Array(3)].map((_, i) => renderSkeleton(i))
                                            ) : vehicles.length > 0 ? (
                                                vehicles.map(vehicle => (
                                                    <TableRow key={vehicle.id}>
                                                        <TableCell>
                                                            <Input type="number" min="0" value={vehicle.quantity} onChange={e => handleDetailChange(vehicle.id, 'quantity', e.target.value)} disabled={!isEditing} className="min-w-16"/>
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            <Input value={vehicle.nombreComercial} onChange={e => handleDetailChange(vehicle.id, 'nombreComercial', e.target.value)} disabled={!isEditing} className="min-w-52" />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input type="number" min="1" value={vehicle.capacidad} onChange={e => handleDetailChange(vehicle.id, 'capacidad', e.target.value)} disabled={!isEditing} className="min-w-16"/>
                                                        </TableCell>
                                                        <TableCell><Input type="number" value={vehicle.costos?.rentaDiaria || 0} onChange={e => handleCostChange(vehicle.id, 'rentaDiaria', e.target.value)} className="text-right min-w-24" disabled={!isEditing}/></TableCell>
                                                        <TableCell><Input type="number" value={vehicle.costos?.rendimientoKmLitro || 0} onChange={e => handleCostChange(vehicle.id, 'rendimientoKmLitro', e.target.value)} className="text-right min-w-24" disabled={!isEditing}/></TableCell>
                                                        <TableCell><Input type="number" step="0.1" value={vehicle.costos?.desgastePorKm || 0} onChange={e => handleCostChange(vehicle.id, 'desgastePorKm', e.target.value)} className="text-right min-w-24" disabled={!isEditing}/></TableCell>
                                                        <TableCell><Input type="number" value={vehicle.costos?.viaticosChoferFueraPorDia || 0} onChange={e => handleCostChange(vehicle.id, 'viaticosChoferFueraPorDia', e.target.value)} className="text-right min-w-24" disabled={!isEditing}/></TableCell>
                                                        <TableCell><Input type="number" value={vehicle.costos?.viaticosChoferCiudadPorDia || 0} onChange={e => handleCostChange(vehicle.id, 'viaticosChoferCiudadPorDia', e.target.value)} className="text-right min-w-24" disabled={!isEditing}/></TableCell>
                                                        <TableCell><Input type="number" value={vehicle.costos?.sad10Horas || 0} onChange={e => handleCostChange(vehicle.id, 'sad10Horas', e.target.value)} className="text-right min-w-24" disabled={!isEditing}/></TableCell>
                                                        <TableCell><Input type="number" value={vehicle.costos?.sad24Horas || 0} onChange={e => handleCostChange(vehicle.id, 'sad24Horas', e.target.value)} className="text-right min-w-24" disabled={!isEditing}/></TableCell>
                                                        <TableCell className="text-right">
                                                           <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={!isEditing}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Esta acción no se puede deshacer. Esto eliminará permanentemente el vehículo
                                                                            de la lista de la base de datos.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleRemoveVehicle(vehicle.id)} className="bg-destructive hover:bg-destructive/90">
                                                                            Sí, eliminar
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                            <TableRow>
                                                    <TableCell colSpan={11} className="text-center h-24">
                                                        No hay vehículos definidos. Active el modo edición para agregar uno.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                             <CardFooter className="flex justify-between border-t pt-6">
                                <div className="flex flex-wrap gap-2">
                                     <Button onClick={handleAddVehicle} variant="outline" disabled={!isEditing}>
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Agregar Vehículo
                                    </Button>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                             <Button variant="outline" disabled={!isEditing}>
                                                <Undo className="mr-2 h-4 w-4" />
                                                Restablecer
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Restablecer a valores por defecto?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esto reemplazará la lista actual con los vehículos y costos predeterminados.
                                                    Aún deberá presionar &apos;Guardar Cambios&apos; para que sea permanente.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleResetToDefaults}>
                                                    Sí, restablecer
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <Button onClick={handleExport} variant="outline">
                                        <FileText className="mr-2 h-4 w-4" />
                                        Exportar Configuración
                                    </Button>
                                </div>
                                <Button onClick={handleSave} disabled={!isEditing || isSaving || isLoading}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {isSaving ? "Guardando..." : "Guardar Cambios"}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>

                    <div className="space-y-8">
                        <Card>
                             <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Cog className="h-5 w-5" />
                                    Configuraciones Generales
                                </CardTitle>
                                <CardDescription>
                                    Ajustes globales para la calculadora.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                               {isClient && (
                                 <div className="space-y-2">
                                    <Label htmlFor="gas-price">Precio de Gasolina (por Litro)</Label>
                                    <div className="relative">
                                        <Fuel className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="gas-price"
                                            type="number"
                                            step="0.1"
                                            value={gasPrice}
                                            onChange={handleGasPriceChange}
                                            disabled={!isEditing}
                                            className="pl-10"
                                            placeholder="28.0"
                                        />
                                    </div>
                                </div>
                               )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Palette className="h-5 w-5" />
                                    Apariencia
                                </CardTitle>
                                <CardDescription>
                                    Personaliza la interfaz de la aplicación.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-2">
                                {isClient && (
                                  <>
                                    <div className="space-y-3">
                                        <Label>Tema</Label>
                                        <RadioGroup
                                            value={theme}
                                            onValueChange={(value) => setTheme(value)}
                                            className="grid grid-cols-3 gap-2"
                                        >
                                            <div>
                                                <RadioGroupItem value="light" id="theme-light" className="peer sr-only" />
                                                <Label htmlFor="theme-light" className="cursor-pointer flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                                    Claro
                                                </Label>
                                            </div>
                                            <div>
                                                <RadioGroupItem value="dark" id="theme-dark" className="peer sr-only" />
                                                <Label htmlFor="theme-dark" className="cursor-pointer flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                                    Oscuro
                                                </Label>
                                            </div>
                                            <div>
                                                <RadioGroupItem value="rolan" id="theme-rolan" className="peer sr-only" />
                                                <Label htmlFor="theme-rolan" className="cursor-pointer flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                                    Rolan
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Tamaño de Fuente</Label>
                                        <RadioGroup
                                            value={fontSize}
                                            onValueChange={(value: FontSize) => handleFontSizeChange(value)}
                                            className="grid grid-cols-3 gap-2"
                                        >
                                            <div>
                                                <RadioGroupItem value="sm" id="font-sm" className="peer sr-only" />
                                                <Label htmlFor="font-sm" className="cursor-pointer flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                                    Pequeño
                                                </Label>
                                            </div>
                                            <div>
                                                <RadioGroupItem value="md" id="font-md" className="peer sr-only" />
                                                <Label htmlFor="font-md" className="cursor-pointer flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                                    Normal
                                                </Label>
                                            </div>
                                            <div>
                                                <RadioGroupItem value="lg" id="font-lg" className="peer sr-only" />
                                                <Label htmlFor="lg" className="cursor-pointer flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                                    Grande
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                  </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
            
            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Exportar Configuración para Soporte</DialogTitle>
                        <DialogDescription>
                            Copia este texto y pégalo en el chat para que el asistente pueda actualizar la configuración por defecto de la aplicación.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative mt-4">
                        <Textarea
                            readOnly
                            value={exportedJson}
                            className="h-72 font-mono text-xs bg-muted/50"
                            aria-label="Configuración de vehículos en formato JSON"
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            className="absolute top-2 right-2 h-8 w-8 text-muted-foreground"
                            onClick={handleCopyToClipboard}
                            aria-label="Copiar al portapapeles"
                        >
                            <ClipboardCopy className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </main>
    );
}
