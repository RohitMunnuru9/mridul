export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          customer_id: string
          full_name: string
          id: string
          is_default: boolean
          landmark: string | null
          line1: string
          line2: string | null
          phone: string
          pincode: string
          state: string
          updated_at: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          customer_id: string
          full_name: string
          id?: string
          is_default?: boolean
          landmark?: string | null
          line1: string
          line2?: string | null
          phone: string
          pincode: string
          state: string
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          customer_id?: string
          full_name?: string
          id?: string
          is_default?: boolean
          landmark?: string | null
          line1?: string
          line2?: string | null
          phone?: string
          pincode?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: unknown
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: unknown
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: unknown
        }
        Relationships: []
      }
      admin_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          session_token: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          session_token?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          session_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string
          hero_media_id: string | null
          id: string
          intro: string
          is_active: boolean
          name: string
          parent_id: string | null
          position: number
          size_chart: Json
          size_chart_note: string
          slug: string
          tagline: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          hero_media_id?: string | null
          id?: string
          intro?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          position?: number
          size_chart?: Json
          size_chart_note?: string
          slug: string
          tagline?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          hero_media_id?: string | null
          id?: string
          intro?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          position?: number
          size_chart?: Json
          size_chart_note?: string
          slug?: string
          tagline?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_hero_media_id_fkey"
            columns: ["hero_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
          show_in_nav: boolean
          slug: string
          tagline: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          show_in_nav?: boolean
          slug: string
          tagline?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          show_in_nav?: boolean
          slug?: string
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_blocks: {
        Row: {
          body: string
          is_active: boolean
          key: string
          placement: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          is_active?: boolean
          key: string
          placement?: string
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          is_active?: boolean
          key?: string
          placement?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          customer_id: string | null
          discount_paise: number
          id: string
          order_id: string
          redeemed_at: string
        }
        Insert: {
          coupon_id: string
          customer_id?: string | null
          discount_paise: number
          id?: string
          order_id: string
          redeemed_at?: string
        }
        Update: {
          coupon_id?: string
          customer_id?: string | null
          discount_paise?: number
          id?: string
          order_id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          amount_off_paise: number | null
          code: string
          created_at: string
          description: string
          ends_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          min_subtotal_paise: number
          percent_off: number | null
          redemption_count: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          amount_off_paise?: number | null
          code: string
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_subtotal_paise?: number
          percent_off?: number | null
          redemption_count?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_off_paise?: number | null
          code?: string
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_subtotal_paise?: number
          percent_off?: number | null
          redemption_count?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          created_at: string
          cta_href: string
          cta_label: string
          ends_at: string | null
          eyebrow: string
          id: string
          is_active: boolean
          media_id: string
          note: string
          position: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_href?: string
          cta_label?: string
          ends_at?: string | null
          eyebrow?: string
          id?: string
          is_active?: boolean
          media_id: string
          note?: string
          position?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_href?: string
          cta_label?: string
          ends_at?: string | null
          eyebrow?: string
          id?: string
          is_active?: boolean
          media_id?: string
          note?: string
          position?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_slides_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_sections: {
        Row: {
          collection_id: string | null
          created_at: string
          description: string
          id: string
          is_enabled: boolean
          key: Database["public"]["Enums"]["homepage_section_key"]
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          collection_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_enabled?: boolean
          key: Database["public"]["Enums"]["homepage_section_key"]
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          collection_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_enabled?: boolean
          key?: Database["public"]["Enums"]["homepage_section_key"]
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homepage_sections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          available: number | null
          on_hand: number
          reserved: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          available?: number | null
          on_hand?: number
          reserved?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          available?: number | null
          on_hand?: number
          reserved?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_posts: {
        Row: {
          body: string | null
          created_at: string
          excerpt: string
          href: string
          id: string
          is_published: boolean
          media_id: string | null
          position: number
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          excerpt?: string
          href?: string
          id?: string
          is_published?: boolean
          media_id?: string | null
          position?: number
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          excerpt?: string
          href?: string
          id?: string
          is_published?: boolean
          media_id?: string | null
          position?: number
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_posts_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          alt: string
          bucket: Database["public"]["Enums"]["media_bucket"]
          byte_size: number | null
          created_at: string
          focal: string
          height: number | null
          id: string
          mime_type: string | null
          path: string
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt?: string
          bucket: Database["public"]["Enums"]["media_bucket"]
          byte_size?: number | null
          created_at?: string
          focal?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          path: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt?: string
          bucket?: Database["public"]["Enums"]["media_bucket"]
          byte_size?: number | null
          created_at?: string
          focal?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          path?: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: []
      }
      mood_tiles: {
        Row: {
          created_at: string
          href: string
          icon: string
          id: string
          is_active: boolean
          label: string
          note: string
          position: number
          tone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          href: string
          icon?: string
          id?: string
          is_active?: boolean
          label: string
          note?: string
          position?: number
          tone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          href?: string
          icon?: string
          id?: string
          is_active?: boolean
          label?: string
          note?: string
          position?: number
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          customer_id: string | null
          error: string | null
          event: string
          id: string
          order_id: string | null
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          template: string
          updated_at: string
          variables: Json
        }
        Insert: {
          attempts?: number
          channel?: string
          created_at?: string
          customer_id?: string | null
          error?: string | null
          event: string
          id?: string
          order_id?: string | null
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          template: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          customer_id?: string | null
          error?: string | null
          event?: string
          id?: string
          order_id?: string | null
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          template?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      occasion_panels: {
        Row: {
          body: string | null
          created_at: string
          cta_href: string
          cta_label: string
          eyebrow: string
          id: string
          is_active: boolean
          position: number
          title: string
          tone: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          cta_href?: string
          cta_label?: string
          eyebrow?: string
          id?: string
          is_active?: boolean
          position?: number
          title: string
          tone: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          cta_href?: string
          cta_label?: string
          eyebrow?: string
          id?: string
          is_active?: boolean
          position?: number
          title?: string
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          line_total_paise: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sku: string
          unit_price_paise: number
          variant_id: string | null
          variant_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          line_total_paise: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          sku?: string
          unit_price_paise: number
          variant_id?: string | null
          variant_label?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          line_total_paise?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string
          unit_price_paise?: number
          variant_id?: string | null
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          cancelled_at: string | null
          confirmed_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          currency: string
          customer_id: string | null
          discount_paise: number
          email: string | null
          id: string
          notes: string | null
          order_number: string
          payment_method: string
          phone: string | null
          placed_at: string
          shipping_address: Json
          shipping_paise: number
          staff_notes: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_paise: number
          total_paise: number
          updated_at: string
        }
        Insert: {
          billing_address?: Json | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_paise?: number
          email?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string
          phone?: string | null
          placed_at?: string
          shipping_address: Json
          shipping_paise?: number
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_paise: number
          total_paise: number
          updated_at?: string
        }
        Update: {
          billing_address?: Json | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_paise?: number
          email?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string
          phone?: string | null
          placed_at?: string
          shipping_address?: Json
          shipping_paise?: number
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_paise?: number
          total_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          failure_reason: string | null
          id: string
          method: string | null
          order_id: string
          provider: string
          provider_order_id: string
          provider_payment_id: string | null
          provider_reference: string | null
          refunded_paise: number
          signature: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount_paise: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          method?: string | null
          order_id: string
          provider?: string
          provider_order_id: string
          provider_payment_id?: string | null
          provider_reference?: string | null
          refunded_paise?: number
          signature?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount_paise?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          method?: string | null
          order_id?: string
          provider?: string
          provider_order_id?: string
          provider_payment_id?: string | null
          provider_reference?: string | null
          refunded_paise?: number
          signature?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          product_id: string
        }
        Insert: {
          category_id: string
          product_id: string
        }
        Update: {
          category_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          collection_id: string
          position: number
          product_id: string
        }
        Insert: {
          collection_id: string
          position?: number
          product_id: string
        }
        Update: {
          collection_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          media_id: string
          position: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          position?: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          position: number
          price_delta_paise: number
          product_id: string
          sku: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          position?: number
          price_delta_paise?: number
          product_id: string
          sku: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          position?: number
          price_delta_paise?: number
          product_id?: string
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: Database["public"]["Enums"]["product_badge"] | null
          blouse_details: string | null
          care: string[]
          colour_hex: string
          colour_name: string
          compare_at_paise: number | null
          created_at: string
          description: string
          fabric: string
          id: string
          is_active: boolean
          is_sold_out: boolean
          name: string
          occasion: string
          price_paise: number
          primary_category_id: string | null
          published_at: string
          rating_average: number | null
          rating_count: number
          slug: string
          subtitle: string
          swatches: string[]
          technique: string
          updated_at: string
        }
        Insert: {
          badge?: Database["public"]["Enums"]["product_badge"] | null
          blouse_details?: string | null
          care?: string[]
          colour_hex?: string
          colour_name?: string
          compare_at_paise?: number | null
          created_at?: string
          description?: string
          fabric?: string
          id?: string
          is_active?: boolean
          is_sold_out?: boolean
          name: string
          occasion?: string
          price_paise: number
          primary_category_id?: string | null
          published_at?: string
          rating_average?: number | null
          rating_count?: number
          slug: string
          subtitle?: string
          swatches?: string[]
          technique?: string
          updated_at?: string
        }
        Update: {
          badge?: Database["public"]["Enums"]["product_badge"] | null
          blouse_details?: string | null
          care?: string[]
          colour_hex?: string
          colour_name?: string
          compare_at_paise?: number | null
          created_at?: string
          description?: string
          fabric?: string
          id?: string
          is_active?: boolean
          is_sold_out?: boolean
          name?: string
          occasion?: string
          price_paise?: number
          primary_category_id?: string | null
          published_at?: string
          rating_average?: number | null
          rating_count?: number
          slug?: string
          subtitle?: string
          swatches?: string[]
          technique?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepts_marketing: boolean
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          accepts_marketing?: boolean
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          accepts_marketing?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          announcements: string[]
          brand_name: string
          contact_email: string
          flat_shipping_paise: number
          free_shipping_threshold_paise: number
          id: boolean
          instagram_url: string
          pending_policies: string[]
          quotes: string[]
          return_window_days: number
          tagline: string
          updated_at: string
          whatsapp_number: string
          youtube_url: string
        }
        Insert: {
          announcements?: string[]
          brand_name?: string
          contact_email?: string
          flat_shipping_paise?: number
          free_shipping_threshold_paise?: number
          id?: boolean
          instagram_url?: string
          pending_policies?: string[]
          quotes?: string[]
          return_window_days?: number
          tagline?: string
          updated_at?: string
          whatsapp_number?: string
          youtube_url?: string
        }
        Update: {
          announcements?: string[]
          brand_name?: string
          contact_email?: string
          flat_shipping_paise?: number
          free_shipping_threshold_paise?: number
          id?: boolean
          instagram_url?: string
          pending_policies?: string[]
          quotes?: string[]
          return_window_days?: number
          tagline?: string
          updated_at?: string
          whatsapp_number?: string
          youtube_url?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          awb: string
          created_at: string
          delivered_at: string | null
          id: string
          order_id: string
          provider: string
          service_code: string | null
          shipped_at: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          awb: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id: string
          provider: string
          service_code?: string | null
          shipped_at?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          awb?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string
          provider?: string
          service_code?: string | null
          shipped_at?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rules: {
        Row: {
          cod_available: boolean
          created_at: string
          estimated_days_max: number | null
          estimated_days_min: number | null
          id: string
          is_active: boolean
          max_subtotal_paise: number | null
          min_subtotal_paise: number
          name: string
          pincode_prefix: string | null
          priority: number
          rate_paise: number
          updated_at: string
        }
        Insert: {
          cod_available?: boolean
          created_at?: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          is_active?: boolean
          max_subtotal_paise?: number | null
          min_subtotal_paise?: number
          name: string
          pincode_prefix?: string | null
          priority?: number
          rate_paise?: number
          updated_at?: string
        }
        Update: {
          cod_available?: boolean
          created_at?: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          is_active?: boolean
          max_subtotal_paise?: number | null
          min_subtotal_paise?: number
          name?: string
          pincode_prefix?: string | null
          priority?: number
          rate_paise?: number
          updated_at?: string
        }
        Relationships: []
      }
      story_panel: {
        Row: {
          body: string
          cta_href: string
          cta_label: string
          eyebrow: string
          id: boolean
          media_id: string | null
          stats: Json
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          cta_href?: string
          cta_label?: string
          eyebrow?: string
          id?: boolean
          media_id?: string | null
          stats?: Json
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          cta_href?: string
          cta_label?: string
          eyebrow?: string
          id?: boolean
          media_id?: string | null
          stats?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_panel_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          author: string
          body: string
          created_at: string
          id: string
          is_published: boolean
          location: string
          media_id: string | null
          position: number
          product_id: string | null
          rating: number
          updated_at: string
        }
        Insert: {
          author: string
          body: string
          created_at?: string
          id?: string
          is_published?: boolean
          location?: string
          media_id?: string | null
          position?: number
          product_id?: string | null
          rating?: number
          updated_at?: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          id?: string
          is_published?: boolean
          location?: string
          media_id?: string | null
          position?: number
          product_id?: string | null
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_events: {
        Row: {
          created_at: string
          description: string
          id: string
          location: string | null
          occurred_at: string
          shipment_id: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          location?: string | null
          occurred_at: string
          shipment_id: string
          status: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          location?: string | null
          occurred_at?: string
          shipment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      value_props: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          note: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon: string
          id?: string
          is_active?: boolean
          note?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          note?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          signature_valid: boolean
        }
        Insert: {
          error?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          signature_valid?: boolean
        }
        Update: {
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          signature_valid?: boolean
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          product_id: string
          wishlist_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          wishlist_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          customer_id: string
          id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      media_usage: {
        Row: {
          alt: string | null
          bucket: Database["public"]["Enums"]["media_bucket"] | null
          focal: string | null
          href: string | null
          kind: string | null
          label: string | null
          media_id: string | null
          path: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_customers: {
        Args: never
        Returns: {
          accepts_marketing: boolean
          city: string | null
          email: string | null
          email_confirmed_at: string | null
          full_name: string | null
          id: string
          is_staff: boolean
          last_order_at: string | null
          last_sign_in_at: string | null
          orders_count: number
          phone: string | null
          sign_in_method: string | null
          signed_up_at: string
          spend_paise: number
          state: string | null
        }[]
      }
      admin_set_stock: { Args: { p_changes: Json }; Returns: Json }
      admin_set_order_status: {
        Args: {
          p_order_id: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      has_admin_role: {
        Args: { required: Database["public"]["Enums"]["admin_role"][] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      mark_order_paid: { Args: { p_order_id: string }; Returns: undefined }
      next_order_number: { Args: never; Returns: string }
      confirm_online_payment: {
        Args: {
          p_amount: number
          p_method?: string | null
          p_order_id: string
          p_payment_id: string
          p_provider: string
          p_reference?: string | null
          p_signature?: string | null
        }
        Returns: Json
      }
      fail_online_payment: {
        Args: { p_order_id: string; p_reason?: string | null }
        Returns: Json
      }
      my_unpaid_order: { Args: { p_order_id?: string | null }; Returns: Json }
      place_order: {
        Args: {
          p_address: Json
          p_coupon?: string | null
          p_items: Json
          /** Omit for cash on delivery: that resolves to the four-argument
           *  overload, which exists on every version of the schema. */
          p_method?: string | null
          p_notes?: string | null
        }
        Returns: Json
      }
      restore_order_stock: { Args: { p_order_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      validate_coupon: {
        Args: { p_code: string; p_subtotal: number }
        Returns: {
          description: string
          discount_paise: number
          ok: boolean
          reason: string
        }[]
      }
    }
    Enums: {
      admin_role:
        | "super_admin"
        | "catalog_manager"
        | "order_manager"
        | "content_manager"
        | "support"
      homepage_section_key:
        | "hero"
        | "mood_tiles"
        | "occasions"
        | "featured_products"
        | "story"
        | "journal"
        | "testimonials"
      media_bucket:
        | "products"
        | "collections"
        | "banners"
        | "homepage"
        | "media"
      order_status:
        | "pending_payment"
        | "confirmed"
        | "processing"
        | "packed"
        | "shipped"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "returned"
        | "refunded"
      payment_status:
        | "pending"
        | "authorized"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
      product_badge: "new" | "bestseller" | "limited" | "back_in_stock"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: [
        "super_admin",
        "catalog_manager",
        "order_manager",
        "content_manager",
        "support",
      ],
      homepage_section_key: [
        "hero",
        "mood_tiles",
        "occasions",
        "featured_products",
        "story",
        "journal",
        "testimonials",
      ],
      media_bucket: ["products", "collections", "banners", "homepage", "media"],
      order_status: [
        "pending_payment",
        "confirmed",
        "processing",
        "packed",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
        "refunded",
      ],
      payment_status: [
        "pending",
        "authorized",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      product_badge: ["new", "bestseller", "limited", "back_in_stock"],
    },
  },
} as const
