
"use client";

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FontSize } from "@/types";

const GAS_PRICE_KEY = 'app-gas-price';
const FONT_SIZE_KEY = 'app-font-size';
const DEFAULT_GAS_PRICE = 28.0;
const DEFAULT_FONT_SIZE: FontSize = 'md';
const CONFIG_DOC_PATH = 'config/general';

// --- Gas Price ---

export const saveGasPrice = async (price: number): Promise<void> => {
    // 1. Guardar en localStorage para acceso inmediato
    if (typeof window !== 'undefined') {
        localStorage.setItem(GAS_PRICE_KEY, price.toString());
    }
    
    // 2. Guardar en Firestore para persistencia permanente
    try {
        const configRef = doc(db, CONFIG_DOC_PATH);
        await setDoc(configRef, { 
            gasPrice: price,
            updatedAt: new Date().toISOString() 
        }, { merge: true });
    } catch (e) {
        console.error("Error saving gas price to Firestore:", e);
        // No lanzamos el error para que el localStorage siga funcionando como fallback
    }
};

export const loadGasPrice = async (): Promise<number> => {
    let price = DEFAULT_GAS_PRICE;

    // 1. Intentar cargar desde Firestore primero
    try {
        const configRef = doc(db, CONFIG_DOC_PATH);
        const docSnap = await getDoc(configRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (typeof data.gasPrice === 'number') {
                price = data.gasPrice;
                // Sincronizar localStorage
                if (typeof window !== 'undefined') {
                    localStorage.setItem(GAS_PRICE_KEY, price.toString());
                }
                return price;
            }
        }
    } catch (e) {
        console.warn("Could not load gas price from Firestore, using local fallback:", e);
    }

    // 2. Fallback al localStorage si Firestore falla o no tiene el dato
    if (typeof window !== 'undefined') {
        const storedPrice = localStorage.getItem(GAS_PRICE_KEY);
        if (storedPrice) {
            const parsed = parseFloat(storedPrice);
            if (!isNaN(parsed)) price = parsed;
        }
    }
    
    return price;
};


// --- Font Size ---

export const saveFontSize = (size: FontSize): void => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(FONT_SIZE_KEY, size);
        document.documentElement.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg');
        document.documentElement.classList.add(`font-size-${size}`);
    }
};

export const loadFontSize = (): FontSize => {
    if (typeof window === 'undefined') {
        return DEFAULT_FONT_SIZE;
    }
    const storedSize = localStorage.getItem(FONT_SIZE_KEY) as FontSize | null;
    if (storedSize && ['sm', 'md', 'lg'].includes(storedSize)) {
        // Aplicar la clase al documento
        document.documentElement.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg');
        document.documentElement.classList.add(`font-size-${storedSize}`);
        return storedSize;
    }
    return DEFAULT_FONT_SIZE;
};
