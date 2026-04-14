
export interface RoadTypeFactor {
  id: string;
  nombre: string;
  desgaste: number;
  combustible: number;
}

export const roadTypeFactors: RoadTypeFactor[] = [
  { id: 'pista', nombre: 'Pista (Carretera)', desgaste: 1.0, combustible: 1.0 },
  { id: 'revestido', nombre: 'Revestido', desgaste: 1.5, combustible: 1.2 },
  { id: 'terraceria', nombre: 'Terracería', desgaste: 2.0, combustible: 1.4 },
];


export interface ClientTypeFactor {
  id: string;
  nombre: string;
  factor: number;
}

export const clientTypeFactors: ClientTypeFactor[] = [
    { id: 'tipo1', nombre: 'Cliente Nuevo (Tipo 1)', factor: 1.0 },
    { id: 'tipo2', nombre: 'Cliente Frecuente (Tipo 2)', factor: 0.9 },
    { id: 'tipo3', nombre: 'Cliente Preferente (Tipo 3)', factor: 0.8 },
    { id: 'tipo4', nombre: 'Casos especiales', factor: 0.7 },
];
