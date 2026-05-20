import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import type { QuoteResult } from '@/types';

const db = getFirestore(app);

function serializeResult(result: QuoteResult) {
  return {
    ...result,
    departureDateTime: result.departureDateTime instanceof Date ? Timestamp.fromDate(result.departureDateTime) : Timestamp.now(),
    returnDateTime: result.returnDateTime instanceof Date ? Timestamp.fromDate(result.returnDateTime) : Timestamp.now(),
    destinationArrivalDateTime: result.destinationArrivalDateTime instanceof Date ? Timestamp.fromDate(result.destinationArrivalDateTime) : null,
    originArrivalDateTime: result.originArrivalDateTime instanceof Date ? Timestamp.fromDate(result.originArrivalDateTime) : null,
    itinerary: result.itinerary?.map(leg => ({
      ...leg,
      departureTime: leg.departureTime instanceof Date ? Timestamp.fromDate(leg.departureTime) : null,
      arrivalTime: leg.arrivalTime instanceof Date ? Timestamp.fromDate(leg.arrivalTime) : null,
    })) || [],
  };
}

export async function saveQuoteToHistory(result: QuoteResult, clientName: string) {
  const docRef = await addDoc(collection(db, 'quote_history'), {
    clientName: clientName || '',
    createdAt: Timestamp.now(),
    ...serializeResult(result),
  });
  return docRef.id;
}

export async function getQuoteHistory(limitCount = 50) {
  const q = query(collection(db, 'quote_history'), orderBy('createdAt', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      departureDateTime: data.departureDateTime?.toDate?.() || null,
      returnDateTime: data.returnDateTime?.toDate?.() || null,
      destinationArrivalDateTime: data.destinationArrivalDateTime?.toDate?.() || null,
      originArrivalDateTime: data.originArrivalDateTime?.toDate?.() || null,
      itinerary: data.itinerary?.map((leg: any) => ({
        ...leg,
        departureTime: leg.departureTime?.toDate?.() || null,
        arrivalTime: leg.arrivalTime?.toDate?.() || null,
      })) || [],
    };
  });
}