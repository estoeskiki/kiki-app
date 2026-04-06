import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { texts, targetLanguage, sourceLanguage = 'es' } = body;

    // Optional early return if empty
    if (!texts || (Array.isArray(texts) && texts.length === 0)) {
       return new Response(JSON.stringify({ translations: [] }), { 
         headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
    }

    const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    
    if (!apiKey) {
      throw new Error("GOOGLE_CLOUD_API_KEY environment variable is missing.");
    }

    const apiUrl = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: texts,
        target: targetLanguage,
        source: sourceLanguage,
        format: 'text', // to avoid HTML entities encoding
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google API Error: ${err}`);
    }

    const data = await response.json();
    const translations = data.data.translations.map((t: any) => t.translatedText);

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
