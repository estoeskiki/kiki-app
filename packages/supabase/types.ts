// Hand-written to match supabase/migrations/*.sql + db.md as of migration 010_web_ordering.sql.
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
    }
    Views: Record<string, never>
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
    }
    Enums: Record<string, never>
  }
}
