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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alertas: {
        Row: {
          created_at: string | null
          id: string
          lido: boolean | null
          mensagem: string
          registro_id: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lido?: boolean | null
          mensagem: string
          registro_id: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lido?: boolean | null
          mensagem?: string
          registro_id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros_ponto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banco_horas: {
        Row: {
          created_at: string | null
          data: string
          expira_em: string
          id: string
          minutos: number
          nota: string | null
          registro_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data: string
          expira_em: string
          id?: string
          minutos: number
          nota?: string | null
          registro_id?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: string
          expira_em?: string
          id?: string
          minutos?: number
          nota?: string | null
          registro_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aceite_termos: boolean
          alternancia_turno: string
          carga_horaria_diaria: number | null
          created_at: string | null
          dias_trabalhados_semana: number
          empresa: string | null
          escala_dias_folga: number | null
          escala_dias_trabalho: number | null
          escala_inicio: string | null
          escala_tipo: string | null
          hora_extra_percentual: number | null
          horario_entrada_padrao: string | null
          horario_saida_padrao: string | null
          id: string
          intervalo_almoco: number
          limite_banco_horas: number | null
          modo_trabalho: string
          nome: string | null
          onboarding_completo: boolean | null
          plano: string | null
          prazo_compensacao_dias: number
          regra_conversao: string
          salario_base: number | null
          tipo_jornada: string
          turno_a_fim: string | null
          turno_a_inicio: string | null
          turno_b_fim: string | null
          turno_b_inicio: string | null
          turno_c_fim: string | null
          turno_c_inicio: string | null
        }
        Insert: {
          aceite_termos?: boolean
          alternancia_turno?: string
          carga_horaria_diaria?: number | null
          created_at?: string | null
          dias_trabalhados_semana?: number
          empresa?: string | null
          escala_dias_folga?: number | null
          escala_dias_trabalho?: number | null
          escala_inicio?: string | null
          escala_tipo?: string | null
          hora_extra_percentual?: number | null
          horario_entrada_padrao?: string | null
          horario_saida_padrao?: string | null
          id: string
          intervalo_almoco?: number
          limite_banco_horas?: number | null
          modo_trabalho?: string
          nome?: string | null
          onboarding_completo?: boolean | null
          plano?: string | null
          prazo_compensacao_dias?: number
          regra_conversao?: string
          salario_base?: number | null
          tipo_jornada?: string
          turno_a_fim?: string | null
          turno_a_inicio?: string | null
          turno_b_fim?: string | null
          turno_b_inicio?: string | null
          turno_c_fim?: string | null
          turno_c_inicio?: string | null
        }
        Update: {
          aceite_termos?: boolean
          alternancia_turno?: string
          carga_horaria_diaria?: number | null
          created_at?: string | null
          dias_trabalhados_semana?: number
          empresa?: string | null
          escala_dias_folga?: number | null
          escala_dias_trabalho?: number | null
          escala_inicio?: string | null
          escala_tipo?: string | null
          hora_extra_percentual?: number | null
          horario_entrada_padrao?: string | null
          horario_saida_padrao?: string | null
          id?: string
          intervalo_almoco?: number
          limite_banco_horas?: number | null
          modo_trabalho?: string
          nome?: string | null
          onboarding_completo?: boolean | null
          plano?: string | null
          prazo_compensacao_dias?: number
          regra_conversao?: string
          salario_base?: number | null
          tipo_jornada?: string
          turno_a_fim?: string | null
          turno_a_inicio?: string | null
          turno_b_fim?: string | null
          turno_b_inicio?: string | null
          turno_c_fim?: string | null
          turno_c_inicio?: string | null
        }
        Relationships: []
      }
      registros_ponto: {
        Row: {
          anexo_url: string | null
          atestado_periodo: string | null
          created_at: string | null
          data: string
          deleted_at: string | null
          editado_em: string | null
          editado_manualmente: boolean
          editado_por: string | null
          entrada: string
          id: string
          intervalo_minutos: number | null
          observacao: string | null
          saida: string | null
          user_id: string
        }
        Insert: {
          anexo_url?: string | null
          atestado_periodo?: string | null
          created_at?: string | null
          data: string
          deleted_at?: string | null
          editado_em?: string | null
          editado_manualmente?: boolean
          editado_por?: string | null
          entrada: string
          id?: string
          intervalo_minutos?: number | null
          observacao?: string | null
          saida?: string | null
          user_id: string
        }
        Update: {
          anexo_url?: string | null
          atestado_periodo?: string | null
          created_at?: string | null
          data?: string
          deleted_at?: string | null
          editado_em?: string | null
          editado_manualmente?: boolean
          editado_por?: string | null
          entrada?: string
          id?: string
          intervalo_minutos?: number | null
          observacao?: string | null
          saida?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_ponto_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_ponto_historico: {
        Row: {
          alterado_em: string | null
          campo_alterado: string
          id: string
          registro_id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          alterado_em?: string | null
          campo_alterado: string
          id?: string
          registro_id: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          alterado_em?: string | null
          campo_alterado?: string
          id?: string
          registro_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_ponto_historico_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros_ponto"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_my_account: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
