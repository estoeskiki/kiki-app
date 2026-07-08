import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.10.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Using the service role key to bypass RLS for updating fiscal information securely
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { orderId } = await req.json()

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Fetch the Order, its Sub-orders, and Order Items
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        id, order_number, total, created_at, customer_name,
        sub_orders (
          id, restaurant_id, total, tax, subtotal,
          restaurants ( id, name, fiscal_api_token, tax_rate ),
          order_items ( id, item_name, quantity, line_total, item_price )
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      throw new Error('Order not found or error fetching order')
    }

    const invoicesData = []
    const fiscalInvoiceIds = []

    // 2. Loop through each sub-order and process the fiscal API call
    for (const subOrder of order.sub_orders) {
      const restaurant = subOrder.restaurants
      
      // If there's no fiscal API token, we skip fiscalization for this restaurant
      if (!restaurant.fiscal_api_token) {
        console.log(`Skipping fiscalization for ${restaurant.name}: No API token found.`)
        continue
      }

      // 3. Build the payload for the DGI API
      const listaItems = subOrder.order_items.map((item: any, index: number) => {
        // Safe parsing for bilingual JSONB if necessary
        let itemName = item.item_name
        if (typeof itemName === 'object' && itemName !== null) {
          itemName = itemName.es || itemName.en || 'Item'
        }

        // Calculate tax correctly (assuming 7% default as configured)
        const priceBeforeTax = item.item_price
        const taxRate = restaurant.tax_rate || 0.07
        const taxAmount = priceBeforeTax * taxRate

        return {
          numeroSecuenciaItem: index + 1,
          descripcionProductoServicio: itemName.substring(0, 500),
          cantidadProductoServicio: item.quantity,
          grupoPrecios: {
            precioUnitario: priceBeforeTax,
            precioItem: priceBeforeTax * item.quantity
          },
          grupoITBMS: {
            tasaITBMS: '01', // Standard 7% ITBMS in Panama code
            valorITBMS: taxAmount * item.quantity
          }
        }
      })

      const payload = {
        datosGenerales: {
          tipoEmision: '01', // Normal operation
          tipoDocumento: '01', // Factura
          puntoFacturacion: '001',
          naturalezaOperacion: '01', // Venta
          tipoOperacion: 1, // Salida o Venta
          destinoOperacion: 1, // Panama
        },
        informacionReceptor: {
          tipoReceptor: '02', // Consumidor Final
        },
        listaItems,
        totales: {
          tiempoPago: 1, // Contado
          grupoFormasPago: [{
            formaPago: '02', // Tarjeta (assuming kiosk)
            montoPago: subOrder.total
          }],
          valorTotalFactura: subOrder.total
        }
      }

      // 4. Call the DGI API
      const dgiApiUrl = 'https://eic-api.ideati.net/api/v1/Invoices?qr=true&xml=true'
      
      try {
        const response = await fetch(dgiApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept-Language': 'es-PA',
            'Authorization': restaurant.fiscal_api_token
          },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`DGI API Error: ${response.status} ${errorText}`)
        }

        const responseData = await response.json()
        
        // 5. Update the sub_order with the fiscal response
        await supabaseAdmin
          .from('sub_orders')
          .update({
            fiscal_invoice_id: responseData.id,
            fiscal_cufe: responseData.cufe,
            fiscal_protocol: responseData.protocoloAutorizacion,
            fiscal_qr_content: responseData.qrContent,
            fiscal_xml: responseData.xml
          })
          .eq('id', subOrder.id)

        fiscalInvoiceIds.push(responseData.id)
        
        invoicesData.push({
          subOrderId: subOrder.id,
          restaurantName: restaurant.name,
          cufe: responseData.cufe,
          qrContent: responseData.qrContent
        })

      } catch (err: any) {
        console.error(`Failed to generate invoice for subOrder ${subOrder.id}:`, err.message)
        // Depending on business logic, we might want to continue with other sub-orders 
        // even if one fails, or halt. We will continue and log the error.
      }
    }

    // 6. Update the parent order with all the generated fiscal invoice IDs
    if (fiscalInvoiceIds.length > 0) {
      await supabaseAdmin
        .from('orders')
        .update({
          fiscal_invoice_ids: fiscalInvoiceIds
        })
        .eq('id', orderId)
    }

    // 7. Return the data needed by the Kiosk to print the fiscal receipts
    return new Response(JSON.stringify({ success: true, invoices: invoicesData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Edge Function Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
