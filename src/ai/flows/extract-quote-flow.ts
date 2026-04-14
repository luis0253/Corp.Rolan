
'use server';
/**
 * @fileOverview A Genkit flow for extracting trip information from unstructured text.
 */

import { ai } from '@/ai/genkit';
import { 
  ExtractQuoteInfoInputSchema, 
  ExtractedQuoteInfoOutputSchema, 
  type ExtractQuoteInfoInput, 
  type ExtractedQuoteInfoOutput 
} from '@/types';

const prompt = ai.definePrompt({
  name: 'extractQuoteInfoPrompt',
  input: { schema: ExtractQuoteInfoInputSchema },
  output: { schema: ExtractedQuoteInfoOutputSchema },
  prompt: `You are an expert data extraction assistant for a transportation company. Your task is to analyze the provided text from a document and meticulously extract the details of a trip. The text might describe a simple round trip or a complex multi-stop itinerary.

Analyze the text and identify the following information:
- The origin of the entire trip.
- The number of people traveling.
- Whether it is a simple trip with one destination or a multi-stop itinerary.
- For a simple trip, identify the final destination, the departure date/time, and the return date/time.
- For a multi-stop itinerary, identify each destination, along with its corresponding arrival and departure dates/times.

Important rules:
- Format all dates and times into a valid ISO 8601 string (e.g., "2024-10-26T09:00:00.000Z").
- If any piece of information is not explicitly mentioned in the text, its corresponding field in the output should be null.
- If the text describes multiple stops, set the 'isItinerary' flag to true and populate the 'stops' array. For a simple A-to-B-to-A trip, set 'isItinerary' to false.
- Be intelligent about interpreting dates. "Mañana" should be resolved to tomorrow's date. "Próximo lunes" should resolve to the upcoming Monday. Today's date is ${new Date().toISOString()}.
- Pay close attention to distinguishing between departure from origin, arrival at a stop, departure from a stop, and final return to origin.

Provide your answer ONLY as a valid JSON object that conforms to the requested output schema. Do not include any other text, explanation, or conversational filler in your response.

Document Text:
{{{documentText}}}
`,
  model: 'googleai/gemini-2.5-flash',
});

const extractQuoteInfoFlow = ai.defineFlow(
  {
    name: 'extractQuoteInfoFlow',
    inputSchema: ExtractQuoteInfoInputSchema,
    outputSchema: ExtractedQuoteInfoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

export async function extractQuoteInfo(input: ExtractQuoteInfoInput): Promise<ExtractedQuoteInfoOutput> {
  return extractQuoteInfoFlow(input);
}
