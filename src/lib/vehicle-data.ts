import {
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  orderBy,
  FirestoreError,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Vehicle } from '@/types';

const VEHICLE_COLLECTION = 'vehiculos';

// The default vehicle data to be used if Firestore is empty.
// This data will be shown on the settings page and can be saved to Firestore.
export const defaultVehicles: Vehicle[] = [
  {
    id: 'default-audi',
    nombreComercial: 'Audi',
    capacidad: 4,
    quantity: 1,
    costos: {
      rentaDiaria: 3000,
      rendimientoKmLitro: 5,
      desgastePorKm: 3,
      viaticosChoferFueraPorDia: 1700,
      viaticosChoferCiudadPorDia: 800,
      sad10Horas: 4000,
      sad24Horas: 10000,
    },
  },
  {
    id: 'default-highlander',
    nombreComercial: 'Toyota Highlander',
    capacidad: 5,
    quantity: 1,
    costos: {
      rentaDiaria: 2500,
      rendimientoKmLitro: 6,
      desgastePorKm: 2.5,
      viaticosChoferFueraPorDia: 1700,
      viaticosChoferCiudadPorDia: 800,
      sad10Horas: 4000,
      sad24Horas: 8000,
    },
  },
  {
    id: 'default-vito',
    nombreComercial: 'Mercedes Benz Vito',
    capacidad: 7,
    quantity: 1,
    costos: {
      rentaDiaria: 2000,
      rendimientoKmLitro: 8,
      desgastePorKm: 2.2,
      viaticosChoferFueraPorDia: 1700,
      viaticosChoferCiudadPorDia: 800,
      sad10Horas: 4500,
      sad24Horas: 8000,
    },
  },
  {
    id: 'default-hiace',
    nombreComercial: 'Toyota Hiace',
    capacidad: 11,
    quantity: 1,
    costos: {
      rentaDiaria: 2500,
      rendimientoKmLitro: 6,
      desgastePorKm: 2.2,
      viaticosChoferFueraPorDia: 1700,
      viaticosChoferCiudadPorDia: 800,
      sad10Horas: 4500,
      sad24Horas: 9000,
    },
  },
  {
    id: 'default-sprinter-corta',
    nombreComercial: 'Sprinter Corta',
    capacidad: 15,
    quantity: 1,
    costos: {
      rentaDiaria: 3000,
      rendimientoKmLitro: 7,
      desgastePorKm: 2.2,
      viaticosChoferFueraPorDia: 1700,
      viaticosChoferCiudadPorDia: 800,
      sad10Horas: 5000,
      sad24Horas: 10000,
    },
  },
  {
    id: 'default-sprinter',
    nombreComercial: 'Sprinter',
    capacidad: 20,
    quantity: 4,
    costos: {
      rentaDiaria: 3300,
      rendimientoKmLitro: 6.5,
      desgastePorKm: 2.2,
      viaticosChoferFueraPorDia: 1700,
      viaticosChoferCiudadPorDia: 800,
      sad10Horas: 5000,
      sad24Horas: 10000,
    },
  },
];


// Fetches all vehicles from Firestore. If the collection is empty, returns a default list.
export const getVehicles = async (): Promise<Vehicle[]> => {
  try {
    const vehiclesRef = collection(db, VEHICLE_COLLECTION);
    const q = query(vehiclesRef, orderBy("capacidad", "asc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // If Firestore is empty, return the hardcoded default list.
      // The user can then save this list to populate Firestore.
      return defaultVehicles;
    }

    const vehicles = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Vehicle[];
    
    return vehicles;
  } catch (error) {
    console.error("Firestore getVehicles error:", error);
    if (error instanceof FirestoreError) {
        // Provide a more specific error message for common issues
        if (error.code === 'permission-denied') {
            throw new Error("Permiso denegado. Revisa las reglas de seguridad de Firestore.");
        }
    }
    // Re-throw a more detailed error to be handled by the UI
    throw new Error(`Error al cargar vehículos: ${(error as Error).message}`);
  }
};

// Saves the provided list of vehicles to Firestore, handling additions, updates, and deletions.
export const saveVehicles = async (updatedVehicles: Vehicle[]): Promise<void> => {
    const batch = writeBatch(db);
    const vehiclesCollectionRef = collection(db, VEHICLE_COLLECTION);

    try {
      const existingDocsSnapshot = await getDocs(vehiclesCollectionRef);
      const existingDocIds = new Set(existingDocsSnapshot.docs.map(doc => doc.id));
      const updatedDocIds = new Set<string>();

      updatedVehicles.forEach(vehicle => {
          const { id, ...vehicleData } = vehicle;
          
          if (id.startsWith('new-') || id.startsWith('default-')) {
              const newDocRef = doc(vehiclesCollectionRef);
              batch.set(newDocRef, vehicleData);
          } else {
              updatedDocIds.add(id);
              const docRef = doc(db, VEHICLE_COLLECTION, id);
              batch.set(docRef, vehicleData);
          }
      });

      existingDocIds.forEach(id => {
          if (!updatedDocIds.has(id)) {
              const docToDeleteRef = doc(db, VEHICLE_COLLECTION, id);
              batch.delete(docToDeleteRef);
          }
      });

      await batch.commit();
    } catch (error) {
        console.error("Firestore saveVehicles error:", error);
        if (error instanceof FirestoreError) {
            if (error.code === 'permission-denied') {
                throw new Error("Permiso denegado. No se pudieron guardar los cambios. Revisa las reglas de seguridad de Firestore.");
            }
        }
        throw new Error(`Error al guardar vehículos: ${(error as Error).message}`);
    }
};
