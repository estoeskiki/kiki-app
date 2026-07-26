// Hand-written to match supabase/migrations/*.sql + db.md as of migration
// 035_security_hardening.sql.
// Regenerate the authoritative version once the Supabase CLI is linked:
//   supabase gen types typescript --linked > packages/supabase/types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Translatable = { en: string; es: string }

export type OrderType = 'dine-in' | 'takeaway' | 'delivery'
export type OrderStatus = 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
export type OrderChannel = 'kiosk' | 'web'
export type PaymentMethod = 'yappy' | 'cash_on_delivery' | 'card_on_delivery'
export type PaymentStatus = 'pending' | 'paid' | 'failed'
export type MemberRole = 'owner' | 'manager' | 'staff' | 'kiosk_device'

/**
 * Shared argument shape for every dashboard_* aggregate. Each filter is
 * null-tolerant: omitting one means "no constraint on this dimension".
 *
 * Zone filtering has three states, because "no zone" (a walk-up or slug-entry
 * order with table_id IS NULL) is a real bucket that cannot be named in a uuid[]:
 *   - neither set                -> no zone filter
 *   - p_table_ids set            -> those zones
 *   - p_include_unzoned true     -> also (or only) unzoned orders
 */
export type DashboardFilterArgs = {
  p_from: string
  p_to: string
  p_restaurant_ids?: string[] | null
  p_food_court_ids?: string[] | null
  p_org_ids?: string[] | null
  p_channels?: OrderChannel[] | null
  p_table_ids?: string[] | null
  p_statuses?: OrderStatus[] | null
  p_include_unzoned?: boolean | null
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          slogan: string | null
          welcome_bg_url: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['organizations']['Row']> & { name: string; slug: string }
        Update: Partial<Database['public']['Tables']['organizations']['Row']>
        Relationships: []
      }
      org_members: {
        Row: {
          id: string
          user_id: string
          org_id: string
          restaurant_id: string | null
          role: MemberRole
          display_name: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['org_members']['Row']> & { user_id: string; org_id: string; role: MemberRole }
        Update: Partial<Database['public']['Tables']['org_members']['Row']>
        Relationships: []
      }
      food_courts: {
        Row: {
          id: string
          name: string
          slug: string
          address: string | null
          logo_url: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['food_courts']['Row']> & { name: string; slug: string }
        Update: Partial<Database['public']['Tables']['food_courts']['Row']>
        Relationships: []
      }
      food_court_members: {
        Row: {
          id: string
          user_id: string
          food_court_id: string
          role: MemberRole
          display_name: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['food_court_members']['Row']> & { user_id: string; food_court_id: string; role: MemberRole }
        Update: Partial<Database['public']['Tables']['food_court_members']['Row']>
        Relationships: []
      }
      restaurants: {
        Row: {
          id: string
          org_id: string
          food_court_id: string | null
          name: string
          slug: string
          address: string | null
          is_open: boolean
          timezone: string
          currency: string
          tax_rate: number
          fiscal_api_token: string | null
          logo_url: string | null
          slogan: string | null
          welcome_bg_url: string | null
          // Public visibility (023_restaurant_visibility): false hides the
          // storefront without deleting any data.
          is_active: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['restaurants']['Row']> & { org_id: string; name: string; slug: string }
        Update: Partial<Database['public']['Tables']['restaurants']['Row']>
        Relationships: []
      }
      device_tokens: {
        Row: {
          id: string
          restaurant_id: string | null
          food_court_id: string | null
          device_name: string
          token_hash: string
          is_active: boolean
          last_seen_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['device_tokens']['Row']> & { device_name: string; token_hash: string }
        Update: Partial<Database['public']['Tables']['device_tokens']['Row']>
        Relationships: []
      }
      tables: {
        Row: {
          id: string
          restaurant_id: string | null
          food_court_id: string | null
          label: string
          qr_token: string
          is_active: boolean
          // 018_food_court_zones: Sala VIP-style zones let the customer type a
          // table number, since one QR covers many physical tables.
          allows_manual_number: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['tables']['Row']> & { label: string }
        Update: Partial<Database['public']['Tables']['tables']['Row']>
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          restaurant_id: string
          name: Translatable
          slug: string
          icon: string | null
          sort_order: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['categories']['Row']> & { restaurant_id: string; name: Translatable; slug: string }
        Update: Partial<Database['public']['Tables']['categories']['Row']>
        Relationships: []
      }
      menu_items: {
        Row: {
          id: string
          restaurant_id: string
          category_id: string
          name: Translatable
          description: Translatable | null
          price: number
          image_url: string | null
          available: boolean
          popular: boolean
          sort_order: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['menu_items']['Row']> & { restaurant_id: string; category_id: string; name: Translatable; price: number }
        Update: Partial<Database['public']['Tables']['menu_items']['Row']>
        Relationships: []
      }
      customization_groups: {
        Row: {
          id: string
          menu_item_id: string
          restaurant_id: string
          name: Translatable
          required: boolean
          max_selections: number
          sort_order: number
        }
        Insert: Partial<Database['public']['Tables']['customization_groups']['Row']> & { menu_item_id: string; restaurant_id: string; name: Translatable }
        Update: Partial<Database['public']['Tables']['customization_groups']['Row']>
        Relationships: []
      }
      customization_options: {
        Row: {
          id: string
          group_id: string
          restaurant_id: string
          name: Translatable
          price_modifier: number
          sort_order: number
        }
        Insert: Partial<Database['public']['Tables']['customization_options']['Row']> & { group_id: string; restaurant_id: string; name: Translatable }
        Update: Partial<Database['public']['Tables']['customization_options']['Row']>
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          restaurant_id: string | null
          food_court_id: string | null
          order_number: number
          order_type: OrderType
          status: OrderStatus
          subtotal: number
          tax: number
          total: number
          customer_name: string | null
          customer_phone: string | null
          channel: OrderChannel
          payment_method: PaymentMethod | null
          payment_status: PaymentStatus
          table_id: string | null
          table_label: string | null
          // 018_food_court_zones: free text the customer types inside a
          // manual-number zone. Display only — reporting groups on table_id.
          table_number: string | null
          notes: string | null
          delivery_address: Json | null
          fiscal_invoice_ids: string[]
          created_by: string | null
          accepted_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['orders']['Row']> & { order_number: number; order_type: OrderType }
        Update: Partial<Database['public']['Tables']['orders']['Row']>
        Relationships: []
      }
      sub_orders: {
        Row: {
          id: string
          order_id: string
          restaurant_id: string
          order_number: number
          customer_name: string | null
          customer_phone: string | null
          order_type: OrderType
          status: OrderStatus
          subtotal: number
          tax: number
          total: number
          channel: OrderChannel
          payment_method: PaymentMethod | null
          payment_status: PaymentStatus
          table_label: string | null
          table_number: string | null
          notes: string | null
          cancellation_reason: string | null
          delivery_address: Json | null
          fiscal_invoice_id: string | null
          fiscal_cufe: string | null
          fiscal_protocol: string | null
          fiscal_qr_content: string | null
          fiscal_xml: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['sub_orders']['Row']> & { order_id: string; restaurant_id: string; order_number: number }
        Update: Partial<Database['public']['Tables']['sub_orders']['Row']>
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          sub_order_id: string | null
          restaurant_id: string
          menu_item_id: string | null
          item_name: string
          item_price: number
          quantity: number
          line_total: number
        }
        Insert: Partial<Database['public']['Tables']['order_items']['Row']> & { order_id: string; restaurant_id: string; item_name: string; item_price: number; line_total: number }
        Update: Partial<Database['public']['Tables']['order_items']['Row']>
        Relationships: []
      }
      order_item_customizations: {
        Row: {
          id: string
          order_item_id: string
          restaurant_id: string
          group_name: string
          option_name: string
          price_modifier: number
        }
        Insert: Partial<Database['public']['Tables']['order_item_customizations']['Row']> & { order_item_id: string; restaurant_id: string; group_name: string; option_name: string }
        Update: Partial<Database['public']['Tables']['order_item_customizations']['Row']>
        Relationships: []
      }
      daily_sequences: {
        Row: {
          restaurant_id: string
          seq_date: string
          last_number: number
        }
        Insert: Partial<Database['public']['Tables']['daily_sequences']['Row']> & { restaurant_id: string; seq_date: string }
        Update: Partial<Database['public']['Tables']['daily_sequences']['Row']>
        Relationships: []
      }
      // 031_platform_admins: SaaS-operator identity. Membership is what
      // is_platform_admin() checks, and every RLS policy ORs that in front of
      // its tenant scope.
      platform_admins: {
        Row: {
          user_id: string
          note: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['platform_admins']['Row']> & { user_id: string }
        Update: Partial<Database['public']['Tables']['platform_admins']['Row']>
        Relationships: []
      }
    }
    Views: {
      // 034_dashboard_rpcs. security_invoker view over
      // sub_orders x orders x restaurants — the read model for the dashboard.
      // One row per (order, restaurant): a food-court order fans out, so never
      // SUM(orders.total) across stalls, and count orders with
      // COUNT(DISTINCT order_id).
      dashboard_order_facts: {
        Row: {
          sub_order_id: string
          order_id: string
          order_number: number
          restaurant_id: string
          restaurant_name: string
          org_id: string
          currency: string
          timezone: string
          food_court_id: string | null
          table_id: string | null
          table_label: string | null
          table_number: string | null
          status: OrderStatus
          channel: OrderChannel
          order_type: OrderType
          payment_method: PaymentMethod | null
          payment_status: PaymentStatus
          customer_name: string | null
          customer_phone: string | null
          notes: string | null
          cancellation_reason: string | null
          subtotal: number
          tax: number
          total: number
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      next_order_number: {
        Args: { p_restaurant_id?: string | null; p_food_court_id?: string | null }
        Returns: number
      }
      authenticate_device: {
        Args: { p_token_hash: string }
        Returns: {
          device_id: string
          ret_org_id: string
          ret_restaurant_id: string | null
          ret_food_court_id: string | null
          ret_device_name: string
        }
      }
      get_public_storefront: {
        Args: { p_slug?: string | null; p_table_token?: string | null }
        Returns: Json
      }
      get_order_status_public: {
        Args: { p_order_id: string }
        Returns: Json
      }
      get_orderable_zones: {
        Args: { p_food_court_id?: string | null; p_restaurant_id?: string | null }
        Returns: Json
      }
      is_platform_admin: { Args: Record<string, never>; Returns: boolean }
      is_restaurant_public: { Args: { p_restaurant_id: string }; Returns: boolean }

      // ─── admin-web dashboard (034_dashboard_rpcs) ───────────────────────
      // All SECURITY INVOKER: RLS runs inside them, so these arguments can only
      // narrow what the caller is already allowed to see. Payload shapes are in
      // apps/admin-web/lib/types.ts.
      get_viewer_context: { Args: Record<string, never>; Returns: Json }
      dashboard_scope_tree: { Args: Record<string, never>; Returns: Json }
      dashboard_kpis: { Args: DashboardFilterArgs; Returns: Json }
      dashboard_timeseries: { Args: DashboardFilterArgs; Returns: Json }
      dashboard_channel_breakdown: { Args: DashboardFilterArgs; Returns: Json }
      dashboard_zone_breakdown: { Args: DashboardFilterArgs; Returns: Json }
      dashboard_status_funnel: { Args: DashboardFilterArgs; Returns: Json }
      dashboard_hour_dow_heatmap: { Args: DashboardFilterArgs; Returns: Json }
      dashboard_top_items: { Args: DashboardFilterArgs & { p_limit?: number }; Returns: Json }
    }
    Enums: Record<string, never>
  }
}
