export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      app_user_roles: {
        Row: {
          created_at: string;
          granted_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          granted_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          after_data: Json | null;
          before_data: Json | null;
          correlation_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          correlation_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          correlation_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          country_code: string | null;
          created_at: string;
          id: string;
          name: string;
          normalized_name: string;
          slug: string;
          updated_at: string;
          website_url: string | null;
        };
        ComputedFields: never;
        Insert: {
          country_code?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          normalized_name: string;
          slug: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          country_code?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          normalized_name?: string;
          slug?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          parent_id: string | null;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          parent_id?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          parent_id?: string | null;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      flavor_tags: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      product_aliases: {
        Row: {
          alias: string;
          created_at: string;
          id: string;
          locale: string | null;
          normalized_alias: string;
          product_id: string;
        };
        ComputedFields: never;
        Insert: {
          alias: string;
          created_at?: string;
          id?: string;
          locale?: string | null;
          normalized_alias: string;
          product_id: string;
        };
        Update: {
          alias?: string;
          created_at?: string;
          id?: string;
          locale?: string | null;
          normalized_alias?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_aliases_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_barcodes: {
        Row: {
          barcode: string;
          country_code: string | null;
          created_at: string;
          format: string;
          id: string;
          product_id: string;
        };
        ComputedFields: never;
        Insert: {
          barcode: string;
          country_code?: string | null;
          created_at?: string;
          format: string;
          id?: string;
          product_id: string;
        };
        Update: {
          barcode?: string;
          country_code?: string | null;
          created_at?: string;
          format?: string;
          id?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_barcodes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_flavors: {
        Row: {
          flavor_tag_id: string;
          product_id: string;
        };
        ComputedFields: never;
        Insert: {
          flavor_tag_id: string;
          product_id: string;
        };
        Update: {
          flavor_tag_id?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_flavors_flavor_tag_id_fkey";
            columns: ["flavor_tag_id"];
            isOneToOne: false;
            referencedRelation: "flavor_tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_flavors_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt_text: string | null;
          created_at: string;
          created_by: string | null;
          external_url: string | null;
          id: string;
          is_primary: boolean;
          is_verified: boolean;
          license: string | null;
          product_id: string;
          source_kind: Database["public"]["Enums"]["source_kind"];
          source_url: string | null;
          storage_path: string | null;
        };
        ComputedFields: never;
        Insert: {
          alt_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          external_url?: string | null;
          id?: string;
          is_primary?: boolean;
          is_verified?: boolean;
          license?: string | null;
          product_id: string;
          source_kind: Database["public"]["Enums"]["source_kind"];
          source_url?: string | null;
          storage_path?: string | null;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          external_url?: string | null;
          id?: string;
          is_primary?: boolean;
          is_verified?: boolean;
          license?: string | null;
          product_id?: string;
          source_kind?: Database["public"]["Enums"]["source_kind"];
          source_url?: string | null;
          storage_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_sources: {
        Row: {
          confidence: number | null;
          created_at: string;
          field_names: string[];
          id: string;
          license: string | null;
          product_id: string;
          provider_record_id: string | null;
          raw_metadata: NonNullable<Json>;
          source_kind: Database["public"]["Enums"]["source_kind"];
          source_url: string | null;
        };
        ComputedFields: never;
        Insert: {
          confidence?: number | null;
          created_at?: string;
          field_names?: string[];
          id?: string;
          license?: string | null;
          product_id: string;
          provider_record_id?: string | null;
          raw_metadata?: NonNullable<Json>;
          source_kind: Database["public"]["Enums"]["source_kind"];
          source_url?: string | null;
        };
        Update: {
          confidence?: number | null;
          created_at?: string;
          field_names?: string[];
          id?: string;
          license?: string | null;
          product_id?: string;
          provider_record_id?: string | null;
          raw_metadata?: NonNullable<Json>;
          source_kind?: Database["public"]["Enums"]["source_kind"];
          source_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_sources_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          archived_at: string | null;
          brand_id: string;
          caffeine_mg_per_100ml: number | null;
          calories_per_100ml: number | null;
          category_id: string | null;
          country_code: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          flavor: string | null;
          id: string;
          ingredients: string | null;
          introduced_year: number | null;
          is_discontinued: boolean | null;
          is_limited_edition: boolean | null;
          is_sugar_free: boolean | null;
          name: string;
          normalized_name: string;
          product_line: string | null;
          regional_availability: string[] | null;
          size_ml: number | null;
          sugar_g_per_100ml: number | null;
          sweeteners: string[] | null;
          updated_at: string;
          variant: string | null;
          verification_status: Database["public"]["Enums"]["product_verification_status"];
          verified_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          brand_id: string;
          caffeine_mg_per_100ml?: number | null;
          calories_per_100ml?: number | null;
          category_id?: string | null;
          country_code?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          flavor?: string | null;
          id?: string;
          ingredients?: string | null;
          introduced_year?: number | null;
          is_discontinued?: boolean | null;
          is_limited_edition?: boolean | null;
          is_sugar_free?: boolean | null;
          name: string;
          normalized_name: string;
          product_line?: string | null;
          regional_availability?: string[] | null;
          size_ml?: number | null;
          sugar_g_per_100ml?: number | null;
          sweeteners?: string[] | null;
          updated_at?: string;
          variant?: string | null;
          verification_status?: Database["public"]["Enums"]["product_verification_status"];
          verified_at?: string | null;
        };
        Update: {
          archived_at?: string | null;
          brand_id?: string;
          caffeine_mg_per_100ml?: number | null;
          calories_per_100ml?: number | null;
          category_id?: string | null;
          country_code?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          flavor?: string | null;
          id?: string;
          ingredients?: string | null;
          introduced_year?: number | null;
          is_discontinued?: boolean | null;
          is_limited_edition?: boolean | null;
          is_sugar_free?: boolean | null;
          name?: string;
          normalized_name?: string;
          product_line?: string | null;
          regional_availability?: string[] | null;
          size_ml?: number | null;
          sugar_g_per_100ml?: number | null;
          sweeteners?: string[] | null;
          updated_at?: string;
          variant?: string | null;
          verification_status?: Database["public"]["Enums"]["product_verification_status"];
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          onboarding_completed_at: string | null;
          preferred_locale: string;
          updated_at: string;
          user_id: string;
          username: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          onboarding_completed_at?: string | null;
          preferred_locale?: string;
          updated_at?: string;
          user_id: string;
          username?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          onboarding_completed_at?: string | null;
          preferred_locale?: string;
          updated_at?: string;
          user_id?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      rate_limit_events: {
        Row: {
          action: string;
          id: number;
          occurred_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          id?: never;
          occurred_at?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          id?: never;
          occurred_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          aftertaste_rating: number | null;
          body: string | null;
          created_at: string;
          design_rating: number | null;
          freshness_rating: number | null;
          id: string;
          product_id: string;
          rating: number;
          sweetness_rating: number | null;
          tags: string[];
          taste_rating: number | null;
          tasting_session_id: string | null;
          updated_at: string;
          user_id: string;
          value_rating: number | null;
        };
        ComputedFields: never;
        Insert: {
          aftertaste_rating?: number | null;
          body?: string | null;
          created_at?: string;
          design_rating?: number | null;
          freshness_rating?: number | null;
          id?: string;
          product_id: string;
          rating: number;
          sweetness_rating?: number | null;
          tags?: string[];
          taste_rating?: number | null;
          tasting_session_id?: string | null;
          updated_at?: string;
          user_id: string;
          value_rating?: number | null;
        };
        Update: {
          aftertaste_rating?: number | null;
          body?: string | null;
          created_at?: string;
          design_rating?: number | null;
          freshness_rating?: number | null;
          id?: string;
          product_id?: string;
          rating?: number;
          sweetness_rating?: number | null;
          tags?: string[];
          taste_rating?: number | null;
          tasting_session_id?: string | null;
          updated_at?: string;
          user_id?: string;
          value_rating?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_tasting_session_id_fkey";
            columns: ["tasting_session_id"];
            isOneToOne: false;
            referencedRelation: "tasting_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      scan_candidates: {
        Row: {
          confidence: string;
          created_at: string;
          hypothesis: NonNullable<Json>;
          id: string;
          position: number;
          product_id: string | null;
          scan_id: string;
          score: number;
        };
        ComputedFields: never;
        Insert: {
          confidence: string;
          created_at?: string;
          hypothesis?: NonNullable<Json>;
          id?: string;
          position: number;
          product_id?: string | null;
          scan_id: string;
          score: number;
        };
        Update: {
          confidence?: string;
          created_at?: string;
          hypothesis?: NonNullable<Json>;
          id?: string;
          position?: number;
          product_id?: string | null;
          scan_id?: string;
          score?: number;
        };
        Relationships: [
          {
            foreignKeyName: "scan_candidates_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scan_candidates_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "scans";
            referencedColumns: ["id"];
          },
        ];
      };
      scan_confirmations: {
        Row: {
          created_at: string;
          id: string;
          idempotency_key: string;
          result: NonNullable<Json>;
          scan_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          idempotency_key: string;
          result: NonNullable<Json>;
          scan_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          result?: NonNullable<Json>;
          scan_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scan_confirmations_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: true;
            referencedRelation: "scans";
            referencedColumns: ["id"];
          },
        ];
      };
      scans: {
        Row: {
          barcode: string | null;
          created_at: string;
          failure_code: string | null;
          id: string;
          idempotency_key: string;
          image_fingerprint: string | null;
          image_path: string | null;
          input_kind: string;
          matched_product_id: string | null;
          provider_usage: NonNullable<Json>;
          status: Database["public"]["Enums"]["scan_status"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          barcode?: string | null;
          created_at?: string;
          failure_code?: string | null;
          id?: string;
          idempotency_key: string;
          image_fingerprint?: string | null;
          image_path?: string | null;
          input_kind: string;
          matched_product_id?: string | null;
          provider_usage?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["scan_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          barcode?: string | null;
          created_at?: string;
          failure_code?: string | null;
          id?: string;
          idempotency_key?: string;
          image_fingerprint?: string | null;
          image_path?: string | null;
          input_kind?: string;
          matched_product_id?: string | null;
          provider_usage?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["scan_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scans_matched_product_id_fkey";
            columns: ["matched_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      tasting_sessions: {
        Row: {
          created_at: string;
          currency: string | null;
          id: string;
          location: string | null;
          notes: string | null;
          price: number | null;
          product_id: string;
          store: string | null;
          tasted_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          currency?: string | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          price?: number | null;
          product_id: string;
          store?: string | null;
          tasted_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          price?: number | null;
          product_id?: string;
          store?: string | null;
          tasted_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasting_sessions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      user_collections: {
        Row: {
          added_at: string;
          id: string;
          note: string | null;
          product_id: string;
          status: Database["public"]["Enums"]["collection_status"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          added_at?: string;
          id?: string;
          note?: string | null;
          product_id: string;
          status: Database["public"]["Enums"]["collection_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          added_at?: string;
          id?: string;
          note?: string | null;
          product_id?: string;
          status?: Database["public"]["Enums"]["collection_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_collections_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          app_lock_timeout_minutes: number | null;
          created_at: string;
          notifications: NonNullable<Json>;
          profile_visibility: string;
          theme: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          app_lock_timeout_minutes?: number | null;
          created_at?: string;
          notifications?: NonNullable<Json>;
          profile_visibility?: string;
          theme?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          app_lock_timeout_minutes?: number | null;
          created_at?: string;
          notifications?: NonNullable<Json>;
          profile_visibility?: string;
          theme?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      confirm_scan: {
        Args: {
          p_confirmation: Json;
          p_idempotency_key: string;
          p_scan_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      correct_provisional_product: {
        Args: {
          p_correction: Json;
          p_correlation_id: string;
          p_product_id: string;
        };
        Returns: Json;
      };
      is_moderator: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: {
      app_role: "user" | "moderator" | "admin";
      collection_status:
        | "tried"
        | "want_to_try"
        | "favorite"
        | "disliked"
        | "collected_physical"
        | "want_to_buy"
        | "archived";
      product_verification_status:
        "provisional" | "community_confirmed" | "verified" | "rejected";
      scan_status: "pending" | "identified" | "confirmed" | "failed";
      source_kind:
        "internal" | "open_food_facts" | "manufacturer" | "user" | "openai";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["user", "moderator", "admin"],
      collection_status: [
        "tried",
        "want_to_try",
        "favorite",
        "disliked",
        "collected_physical",
        "want_to_buy",
        "archived",
      ],
      product_verification_status: [
        "provisional",
        "community_confirmed",
        "verified",
        "rejected",
      ],
      scan_status: ["pending", "identified", "confirmed", "failed"],
      source_kind: [
        "internal",
        "open_food_facts",
        "manufacturer",
        "user",
        "openai",
      ],
    },
  },
} as const;
