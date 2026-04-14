// src/components/pdf-template.tsx
"use client";

import { RolanLogo } from './rolan-logo';
import type { QuoteResult } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Armchair, AirVent, Shield, AudioLines, Tv, Luggage, Users, MapPin, Phone } from 'lucide-react';

interface PdfTemplateProps {
  quote: QuoteResult;
  clientName: string;
}

const numberToWords = (n: number) => {
    if (n > 999999999999999) return 'Número demasiado grande';
    const units = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
    const teens = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
    const tens = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
    const hundreds = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

    if (n === 0) return "cero";

    const getBelow1000 = (num: number) => {
        if (num === 100) return "cien";
        let word = "";
        if (num >= 100) {
            word += hundreds[Math.floor(num / 100)] + " ";
            num %= 100;
        }
        if (num >= 20) {
            word += tens[Math.floor(num / 10)];
            if (num % 10 > 0) word += " y " + units[num % 10];
        } else if (num >= 10) {
            word += teens[num - 10];
        } else if (num > 0) {
            word += units[num];
        }
        return word.trim();
    };

    let words = "";
    const millions = Math.floor(n / 1000000);
    if (millions > 0) {
        words += getBelow1000(millions) + (millions === 1 ? " millón " : " millones ");
        n %= 1000000;
    }

    const thousands = Math.floor(n / 1000);
    if (thousands > 0) {
        words += (thousands === 1 ? "mil " : getBelow1000(thousands) + " mil ");
        n %= 1000;
    }

    if (n > 0) {
        words += getBelow1000(n);
    }

    return words.trim();
};

const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const formatCurrency = (amount: number, withText = false) => {
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100).toString().padStart(2, '0');
  
  const currency = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
  
  if (withText) {
    const words = numberToWords(integerPart);
    return `${currency} (${capitalizeFirstLetter(words)} pesos ${decimalPart}/100 M.N.)`;
  }
  return currency;
};

const formatLongDate = (date: Date) => format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
const formatTime = (date: Date) => format(date, "hh:mm a", { locale: es });

const Feature = ({ icon, text }: { icon: React.ReactNode, text: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon}
        <span style={{ fontSize: '11px' }}>{text}</span>
    </div>
);

const getVehicleImageHint = (vehicleName: string): string => {
    const name = vehicleName.toLowerCase();
    if (name.includes('sprinter')) return 'mercedes benz sprinter van';
    if (name.includes('hiace')) return 'toyota hiace van';
    if (name.includes('vito')) return 'mercedes benz vito van';
    if (name.includes('highlander')) return 'toyota highlander suv';
    if (name.includes('suburban')) return 'chevrolet suburban suv';
    if (name.includes('autobus')) return 'tour bus';
    return 'passenger van';
};


export const PdfTemplate = ({ quote, clientName }: PdfTemplateProps) => {
    const today = new Date();
    const folio = `COT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(Date.now()).slice(-4)}`;

    return (
        <div style={{ fontFamily: "'Montserrat', sans-serif", color: '#333', fontSize: '10pt', lineHeight: 1.5, width: '690px', height: '842px', margin: 'auto', padding: '48px', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', borderBottom: '2px solid #eee', paddingBottom: '16px' }}>
                <RolanLogo />
                <div style={{ textAlign: 'right', fontSize: '9pt' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <MapPin size={12} />
                        <span>Calle Melchor Ocampo #400 Interior Planta Baja #102, Col. Centro, Oaxaca de Juárez, Oax</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                        <Phone size={12} />
                        <span>951 108 67 28</span>
                    </div>
                </div>
            </header>

            {/* Folio and Date */}
            <div style={{ textAlign: 'right', marginBottom: '32px', fontSize: '10pt' }}>
                <p style={{ fontWeight: 'bold' }}>No. Folio: {folio}</p>
                <p>Oaxaca de Juárez, Oaxaca a {format(today, "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
            </div>

            {/* Client Info */}
            <div style={{ marginBottom: '24px' }}>
                <p style={{ fontWeight: 'bold' }}>C. {clientName || "CLIENTE"}</p>
                <p style={{ fontWeight: 'bold' }}>PRESENTE</p>
            </div>

            {/* Introduction */}
            <p style={{ marginBottom: '16px' }}>
                Reciba un cordial Saludo de parte del Equipo de Rolan tours, por este medio le presentamos el presupuesto que amablemente nos solicitó, con el siguiente itinerario.
            </p>

            {/* Itinerary */}
            <div style={{ marginBottom: '16px' }}>
                <p style={{ fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '8px' }}>ITINERARIO</p>
                <ul style={{ listStyleType: 'disc', listStylePosition: 'inside', marginLeft: '8px', fontSize: '10pt' }}>
                    <li style={{ marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold' }}>{formatLongDate(quote.departureDateTime)}.</span><br/>
                        Traslado a {quote.destination} en {quote.vehicleName} partiendo de {quote.origin} a las {formatTime(quote.departureDateTime)}.
                    </li>
                    <li>
                        <span style={{ fontWeight: 'bold' }}>{formatLongDate(quote.returnDateTime)}.</span><br/>
                         Regreso a {quote.origin}, partiendo de {quote.destination} a las {formatTime(quote.returnDateTime)}.
                    </li>
                </ul>
            </div>

            {/* Investment */}
            <p style={{ fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '16px' }}>LA INVERSION PARA EL TRANSPORTE ES DE</p>

            {/* Main Content */}
            <div style={{ display: 'flex', gap: '24px', flex: 1 }}>
                {/* Left Column - Vehicle */}
                <div style={{ width: '50%', backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ backgroundColor: '#0a2b4c', color: 'white', padding: '16px', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
                        <p style={{ textAlign: 'right', fontSize: '10px', opacity: 0.8, fontFamily: "'Montserrat', sans-serif" }}>ROLAN TRANSPORTE</p>
                        <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '-4px' }}>{quote.vehicleName.replace('Mercedes Benz', 'Mercedes-Benz')}</h2>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <img src={`https://placehold.co/800x450.png`} data-ai-hint={getVehicleImageHint(quote.vehicleName)} alt={quote.vehicleName} style={{ width: '100%', display: 'block' }} />
                        <div style={{ position: 'absolute', bottom: '16px', left: '16px', color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: '8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                            <p>951.512.08.18</p>
                            <p>951.214.14.81</p>
                        </div>
                    </div>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 8px', padding: '16px', color: '#4b5563', flex: 1 }}>
                        <Feature icon={<Users size={16} />} text={`${quote.people} Pasajeros`} />
                        <Feature icon={<Luggage size={16} />} text="Área de Equipaje" />
                        <Feature icon={<Armchair size={16} />} text="Asientos Reclinables" />
                        <Feature icon={<AirVent size={16} />} text="Aire Acondicionado" />
                        <Feature icon={<Shield size={16} />} text="Cinturón de Seguridad" />
                        <Feature icon={<AudioLines size={16} />} text="Sistema de Audio" />
                        <Feature icon={<Tv size={16} />} text="TV y DVD" />
                    </div>
                </div>

                {/* Right Column - Pricing */}
                <div style={{ width: '50%' }}>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(quote.total, true)}</p>
                    <p style={{ textAlign: 'right', fontSize: '9pt', marginBottom: '16px' }}>(Sólo aplica pago en efectivo, no incluye IVA si requiere factura)</p>

                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ fontWeight: 'bold', marginBottom: '4px' }}>NUESTRO PRECIO INCLUYE:</h3>
                        <ul style={{ listStyleType: 'disc', listStylePosition: 'inside', fontSize: '10pt', paddingLeft: '4px', lineHeight: 1.6 }}>
                            <li>Renta de Camioneta.</li>
                            <li>Conductor y sus respectivos viáticos.</li>
                            <li>Seguro del viajero.</li>
                            <li>Combustible utilizado durante el trayecto.</li>
                            <li>Peaje de casetas.</li>
                            <li>Transporte local en destino (30 km) a la redonda.</li>
                        </ul>
                    </div>
                     <div>
                        <h3 style={{ fontWeight: 'bold', marginBottom: '4px' }}>NUESTROS PRECIOS NO INCLUYEN:</h3>
                        <ul style={{ listStyleType: 'disc', listStylePosition: 'inside', fontSize: '10pt', paddingLeft: '4px' }}>
                            <li>Cualquier otro concepto no especificado en el apartado anterior.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '16px', borderTop: '2px solid #eee' }}>
                <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '24px', fontWeight: 'bold', color: '#b51f24' }}>ROLAN</p>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '24px', fontWeight: 'bold', color: '#b51f24', marginTop: '-8px' }}>TOURS</p>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <Phone size={12} />
                        <span style={{ fontSize: '11pt', fontWeight: 'bold' }}>951 557 31 42</span>
                    </div>
                </div>
                 <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '24px', fontWeight: 'bold', color: '#555', textAlign: 'right' }}>ROLAN</p>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '14px', color: '#777', textAlign: 'right', marginTop: '-8px' }}>TRANSPORTE</p>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', justifyContent: 'flex-end' }}>
                        <Phone size={12} />
                        <span style={{ fontSize: '11pt', fontWeight: 'bold' }}>951 507 10 62</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};
