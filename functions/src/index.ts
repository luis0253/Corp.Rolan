
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {defineString} from "firebase-functions/params";

initializeApp();

// Clave para el backend (servidor a servidor). Debe tener restricción de IP.
const googleApiKey = defineString("GOOGLE_API_KEY");
// Clave para el frontend (navegador). Debe tener restricción de HTTP por URL.
const googleApiKeyFrontend = defineString("GOOGLE_API_KEY_FRONTEND");


// Define a permissive CORS policy to allow requests from any origin.
const corsOptions = {cors: /.*/};

// This function calculates distance for a simple A->B route.
export const getDistance = onCall(corsOptions, async (request) => {
  const {origin, destination} = request.data;

  if (!origin || !destination) {
    throw new HttpsError(
      "invalid-argument",
      "Faltan los parámetros de origen y destino."
    );
  }

  const apiKey = googleApiKey.value();
  if (!apiKey) {
    console.error("GOOGLE_API_KEY parameter not set in Firebase config.");
    throw new HttpsError(
      "internal",
      "La clave de API de Google Maps no está configurada en el servidor."
    );
  }

  const endpoint = "https://routes.googleapis.com/directions/v2:computeRoutes";

  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    // Field mask to get only necessary data
    "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.description",
  };

  const body = JSON.stringify({
    origin: {address: origin},
    destination: {address: destination},
    travelMode: "DRIVE",
    languageCode: "es-419",
    units: "METRIC",
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: body,
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("Error response from Google Maps Routes API:", data);
      const errorMessage =
        data.error?.message ||
        `El servicio respondió con estado: ${response.status}`;
      const finalMessage = "Falla en el servicio de mapas: " +
      `"${errorMessage}". Verifica que la 'Routes API' esté ` +
      "habilitada en tu proyecto de Google Cloud y que la facturación " +
      "esté activa.";
      throw new HttpsError("internal", finalMessage);
    }

    const route = data.routes?.[0];

    if (!route || typeof route.distanceMeters !== "number") {
        throw new HttpsError(
            "not-found",
            "No se pudo calcular la ruta. Verifique que las direcciones de origen y destino sean válidas y que la 'Routes API' esté habilitada."
        );
    }

    const oneWayDistanceMeters = route.distanceMeters;
    const oneWayDurationString = route.duration; // e.g. "3600s"

    let oneWayDurationSeconds = 0;
    if (oneWayDurationString) {
        oneWayDurationSeconds = parseInt(oneWayDurationString.replace("s", ""), 10);
    }
    
    // The frontend code expects round trip values
    const roundTripDistanceKm = (oneWayDistanceMeters / 1000) * 2;
    const roundTripDurationSeconds = oneWayDurationSeconds * 2;
    
    return {
      roundTripDistanceKm,
      roundTripDurationSeconds,
      routeDescription: route.description || '',
    };

  } catch (error: unknown) {
    console.error("Error calling Google Maps Routes API:", error);

    if (error instanceof HttpsError) {
      throw error; // Re-throw HttpsError directly
    }

    const errorMessage =
      error instanceof Error ?
        error.message :
        "Error desconocido al contactar el servicio de mapas.";
    const finalMessage = "Falla en el servicio de mapas: " +
      `"${errorMessage}". Verifica tu conexión o la configuración de la API.`;

    throw new HttpsError("internal", finalMessage);
  }
});

// NEW FUNCTION: Securely provides the frontend-specific Google Maps API key
// to the client for use with Maps JS SDK (like Autocomplete).
export const getGoogleMapsApiKey = onCall(corsOptions, () => {
  const apiKey = googleApiKeyFrontend.value();
  if (!apiKey) {
    console.error("GOOGLE_API_KEY_FRONTEND parameter not set in Firebase config.");
    throw new HttpsError(
      "internal",
      "La clave de API de Google Maps para el cliente no está configurada."
    );
  }
  return {apiKey};
});

// DEPRECATED - This function is no longer needed as autocomplete is handled
// by the client-side JS SDK. Keeping it here for reference but it can be removed.
export const getPlaceAutocomplete = onCall(corsOptions, async (request) => {
  const {input} = request.data;
  if (!input) {
    throw new HttpsError("invalid-argument", "Falta el parámetro 'input'.");
  }
  
  // Note: This now uses the frontend key, but the client-side implementation is preferred.
  const apiKey = googleApiKeyFrontend.value();
  if (!apiKey) {
    console.error("GOOGLE_API_KEY_FRONTEND parameter not set in Firebase config.");
    throw new HttpsError(
      "internal",
      "La clave de API de Google Maps no está configurada en el servidor."
    );
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.append("input", input);
  url.searchParams.append("key", apiKey);
  url.searchParams.append("language", "es");
  url.searchParams.append("components", "country:mx");

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      const suggestions = data.predictions.map((p: any) => p.description);
      return {suggestions};
    } else if (data.status === "ZERO_RESULTS") {
      return {suggestions: []};
    } else {
      console.error(
        "Error from Google Places API:",
        data.status,
        data.error_message
      );
      throw new HttpsError(
        "internal",
        `Falla en el servicio de autocompletado: ${
          data.error_message || data.status
        }`
      );
    }
  } catch (error: any) {
    console.error("Error calling Google Places API via fetch:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      "internal",
      "Falla al contactar el servicio de autocompletado."
    );
  }
});

    