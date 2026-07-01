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
      activity_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_event_etapas: {
        Row: {
          created_at: string
          etapa_key: string
          event_id: string
          id: string
          position: number
          responsavel: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          etapa_key: string
          event_id: string
          id?: string
          position?: number
          responsavel?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          etapa_key?: string
          event_id?: string
          id?: string
          position?: number
          responsavel?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annual_event_etapas_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "annual_events"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_events: {
        Row: {
          category: string
          color: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          instance_id: string | null
          organization_id: string
          project_id: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          color?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          instance_id?: string | null
          organization_id: string
          project_id?: string | null
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          instance_id?: string | null
          organization_id?: string
          project_id?: string | null
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annual_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "module_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          organization_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          organization_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          organization_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      board_preferences: {
        Row: {
          created_at: string
          id: string
          preferences: Json
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preferences?: Json
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preferences?: Json
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_preferences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_task_reminders: {
        Row: {
          created_at: string
          id: string
          lead_days: number
          metadata: Json
          project_id: string
          remind_at: string
          source_column: string
          status: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_days?: number
          metadata?: Json
          project_id: string
          remind_at: string
          source_column?: string
          status?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_days?: number
          metadata?: Json
          project_id?: string
          remind_at?: string
          source_column?: string
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_task_reminders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_task_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_task_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          category: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          organization_id: string
          pinned_by: string | null
          scope: string
          sector: string | null
          source_id: string
          source_type: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          organization_id: string
          pinned_by?: string | null
          scope?: string
          sector?: string | null
          source_id: string
          source_type: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          organization_id?: string
          pinned_by?: string | null
          scope?: string
          sector?: string | null
          source_id?: string
          source_type?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_dm: boolean
          is_private: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_dm?: boolean
          is_private?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_dm?: boolean
          is_private?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      checklist_template_items: {
        Row: {
          category: string
          hint: string | null
          id: string
          label: string
          position: number
          template_id: string
        }
        Insert: {
          category?: string
          hint?: string | null
          id?: string
          label: string
          position?: number
          template_id: string
        }
        Update: {
          category?: string
          hint?: string | null
          id?: string
          label?: string
          position?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conteudo_activity: {
        Row: {
          action: string
          conteudo_item_id: string
          created_at: string
          from_value: string | null
          id: string
          to_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          conteudo_item_id: string
          created_at?: string
          from_value?: string | null
          id?: string
          to_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          conteudo_item_id?: string
          created_at?: string
          from_value?: string | null
          id?: string
          to_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conteudo_activity_conteudo_item_id_fkey"
            columns: ["conteudo_item_id"]
            isOneToOne: false
            referencedRelation: "conteudo_items"
            referencedColumns: ["id"]
          },
        ]
      }
      conteudo_attachments: {
        Row: {
          conteudo_item_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          conteudo_item_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          conteudo_item_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conteudo_attachments_conteudo_item_id_fkey"
            columns: ["conteudo_item_id"]
            isOneToOne: false
            referencedRelation: "conteudo_items"
            referencedColumns: ["id"]
          },
        ]
      }
      conteudo_checklist_items: {
        Row: {
          assigned_to: string | null
          conteudo_item_id: string
          created_at: string
          custom_fields: Json
          due_date: string | null
          id: string
          position: number
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          conteudo_item_id: string
          created_at?: string
          custom_fields?: Json
          due_date?: string | null
          id?: string
          position?: number
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          conteudo_item_id?: string
          created_at?: string
          custom_fields?: Json
          due_date?: string | null
          id?: string
          position?: number
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conteudo_checklist_items_conteudo_item_id_fkey"
            columns: ["conteudo_item_id"]
            isOneToOne: false
            referencedRelation: "conteudo_items"
            referencedColumns: ["id"]
          },
        ]
      }
      conteudo_code_seq: {
        Row: {
          last_value: number
          organization_id: string
        }
        Insert: {
          last_value?: number
          organization_id: string
        }
        Update: {
          last_value?: number
          organization_id?: string
        }
        Relationships: []
      }
      conteudo_comments: {
        Row: {
          content: string
          conteudo_item_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          conteudo_item_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          conteudo_item_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conteudo_comments_conteudo_item_id_fkey"
            columns: ["conteudo_item_id"]
            isOneToOne: false
            referencedRelation: "conteudo_items"
            referencedColumns: ["id"]
          },
        ]
      }
      conteudo_items: {
        Row: {
          assigned_to: string | null
          channel: string
          code: string | null
          content_category: string | null
          content_type: string
          created_at: string
          created_by: string
          custom_fields: Json
          id: string
          is_repost: boolean
          notes: string | null
          organization_id: string
          photo_url: string | null
          scheduled_date: string | null
          status: string
          time_slot: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel?: string
          code?: string | null
          content_category?: string | null
          content_type?: string
          created_at?: string
          created_by: string
          custom_fields?: Json
          id?: string
          is_repost?: boolean
          notes?: string | null
          organization_id: string
          photo_url?: string | null
          scheduled_date?: string | null
          status?: string
          time_slot?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          code?: string | null
          content_category?: string | null
          content_type?: string
          created_at?: string
          created_by?: string
          custom_fields?: Json
          id?: string
          is_repost?: boolean
          notes?: string | null
          organization_id?: string
          photo_url?: string | null
          scheduled_date?: string | null
          status?: string
          time_slot?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conteudo_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      department_members: {
        Row: {
          created_at: string
          department_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_members_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_favorites: {
        Row: {
          created_at: string
          id: string
          page_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_favorites_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "doc_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_favorites_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_pages: {
        Row: {
          allowed_user_ids: string[]
          can_delete_roles: Database["public"]["Enums"]["app_role"][]
          can_edit_roles: Database["public"]["Enums"]["app_role"][]
          content: string | null
          created_at: string
          created_by: string
          department_id: string | null
          icon: string | null
          id: string
          is_restricted: boolean
          organization_id: string
          parent_id: string | null
          position: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_user_ids?: string[]
          can_delete_roles?: Database["public"]["Enums"]["app_role"][]
          can_edit_roles?: Database["public"]["Enums"]["app_role"][]
          content?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          icon?: string | null
          id?: string
          is_restricted?: boolean
          organization_id: string
          parent_id?: string | null
          position?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_user_ids?: string[]
          can_delete_roles?: Database["public"]["Enums"]["app_role"][]
          can_edit_roles?: Database["public"]["Enums"]["app_role"][]
          content?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          icon?: string | null
          id?: string
          is_restricted?: boolean
          organization_id?: string
          parent_id?: string | null
          position?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_pages_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "doc_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_pages_updated_by_profile_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_global: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_global?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_global?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_preferences: {
        Row: {
          created_at: string
          id: string
          notify_directors: boolean
          notify_on_assignment: boolean
          notify_on_deadline: boolean
          notify_on_mention: boolean
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_directors?: boolean
          notify_on_assignment?: boolean
          notify_on_deadline?: boolean
          notify_on_mention?: boolean
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_directors?: boolean
          notify_on_assignment?: boolean
          notify_on_deadline?: boolean
          notify_on_mention?: boolean
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entity_code_seq: {
        Row: {
          entity_type: string
          last_value: number
          organization_id: string
        }
        Insert: {
          entity_type: string
          last_value?: number
          organization_id: string
        }
        Update: {
          entity_type?: string
          last_value?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_code_seq_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_checklist_items: {
        Row: {
          assignee_id: string | null
          category: string
          checklist_id: string
          completed_at: string | null
          completed_by: string | null
          due_date: string | null
          id: string
          label: string
          notes: string | null
          position: number
          status: string
        }
        Insert: {
          assignee_id?: string | null
          category?: string
          checklist_id: string
          completed_at?: string | null
          completed_by?: string | null
          due_date?: string | null
          id?: string
          label: string
          notes?: string | null
          position?: number
          status?: string
        }
        Update: {
          assignee_id?: string | null
          category?: string
          checklist_id?: string
          completed_at?: string | null
          completed_by?: string | null
          due_date?: string | null
          id?: string
          label?: string
          notes?: string | null
          position?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_checklist_items_assignee_id_profile_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "launch_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_checklists: {
        Row: {
          created_at: string
          created_by: string
          expected_arrival_date: string | null
          id: string
          instance_id: string | null
          launch_id: string | null
          name: string
          organization_id: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expected_arrival_date?: string | null
          id?: string
          instance_id?: string | null
          launch_id?: string | null
          name: string
          organization_id: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expected_arrival_date?: string | null
          id?: string
          instance_id?: string | null
          launch_id?: string | null
          name?: string
          organization_id?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_checklists_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "module_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_checklists_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "launches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_checklists_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_stages: {
        Row: {
          actual_end: string | null
          assignee_id: string | null
          created_at: string
          duration_days: number
          id: string
          launch_id: string
          name: string
          planned_end: string | null
          planned_start: string | null
          position: number
          status: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          assignee_id?: string | null
          created_at?: string
          duration_days?: number
          id?: string
          launch_id: string
          name: string
          planned_end?: string | null
          planned_start?: string | null
          position?: number
          status?: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          assignee_id?: string | null
          created_at?: string
          duration_days?: number
          id?: string
          launch_id?: string
          name?: string
          planned_end?: string | null
          planned_start?: string | null
          position?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_stages_assignee_id_profile_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_stages_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "launches"
            referencedColumns: ["id"]
          },
        ]
      }
      launches: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          instance_id: string | null
          name: string
          organization_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          instance_id?: string | null
          name: string
          organization_id: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          instance_id?: string | null
          name?: string
          organization_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "launches_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "module_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_room_bookings: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string
          id: string
          organization_id: string
          room_id: string
          starts_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          organization_id: string
          room_id: string
          starts_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          organization_id?: string
          room_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_room_bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_room_bookings_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_rooms: {
        Row: {
          capacity: number | null
          color: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          color?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      melhoria_activity: {
        Row: {
          action: string
          created_at: string
          from_value: string | null
          id: string
          melhoria_id: string
          to_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_value?: string | null
          id?: string
          melhoria_id: string
          to_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_value?: string | null
          id?: string
          melhoria_id?: string
          to_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "melhoria_activity_melhoria_id_fkey"
            columns: ["melhoria_id"]
            isOneToOne: false
            referencedRelation: "melhorias"
            referencedColumns: ["id"]
          },
        ]
      }
      melhoria_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          melhoria_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          melhoria_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          melhoria_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "melhoria_attachments_melhoria_id_fkey"
            columns: ["melhoria_id"]
            isOneToOne: false
            referencedRelation: "melhorias"
            referencedColumns: ["id"]
          },
        ]
      }
      melhoria_code_seq: {
        Row: {
          last_value: number
          organization_id: string
        }
        Insert: {
          last_value?: number
          organization_id: string
        }
        Update: {
          last_value?: number
          organization_id?: string
        }
        Relationships: []
      }
      melhoria_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          melhoria_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          melhoria_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          melhoria_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "melhoria_comments_melhoria_id_fkey"
            columns: ["melhoria_id"]
            isOneToOne: false
            referencedRelation: "melhorias"
            referencedColumns: ["id"]
          },
        ]
      }
      melhoria_subitems: {
        Row: {
          assigned_to: string | null
          created_at: string
          custom_fields: Json
          due_date: string | null
          id: string
          melhoria_id: string
          position: number
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          custom_fields?: Json
          due_date?: string | null
          id?: string
          melhoria_id: string
          position?: number
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          custom_fields?: Json
          due_date?: string | null
          id?: string
          melhoria_id?: string
          position?: number
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "melhoria_subitems_melhoria_id_fkey"
            columns: ["melhoria_id"]
            isOneToOne: false
            referencedRelation: "melhorias"
            referencedColumns: ["id"]
          },
        ]
      }
      melhorias: {
        Row: {
          area: string
          assigned_to: string | null
          code: string | null
          created_at: string
          created_by: string
          custom_fields: Json
          data_abertura: string
          data_conclusao: string | null
          description: string | null
          id: string
          organization_id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area?: string
          assigned_to?: string | null
          code?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json
          data_abertura?: string
          data_conclusao?: string | null
          description?: string | null
          id?: string
          organization_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string
          assigned_to?: string | null
          code?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json
          data_abertura?: string
          data_conclusao?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "melhorias_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          parent_message_id: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_message_id?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      module_access: {
        Row: {
          created_at: string
          grantee_id: string
          grantee_type: string
          id: string
          level: string
          module_key: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          grantee_id: string
          grantee_type: string
          id?: string
          level?: string
          module_key: string
          organization_id: string
        }
        Update: {
          created_at?: string
          grantee_id?: string
          grantee_type?: string
          id?: string
          level?: string
          module_key?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      module_instances: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          created_by: string
          description: string | null
          icon: string | null
          id: string
          module_key: string
          name: string
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by: string
          description?: string | null
          icon?: string | null
          id?: string
          module_key: string
          name: string
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          icon?: string | null
          id?: string
          module_key?: string
          name?: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      module_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          organization_id: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      newsletter_activity: {
        Row: {
          action: string
          created_at: string
          from_value: string | null
          id: string
          newsletter_id: string
          to_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_value?: string | null
          id?: string
          newsletter_id: string
          to_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_value?: string | null
          id?: string
          newsletter_id?: string
          to_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_activity_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          newsletter_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          newsletter_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          newsletter_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_comments_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletters: {
        Row: {
          base: string | null
          channel: string
          click_rate: number | null
          created_at: string
          created_by: string
          custom_fields: Json
          hora: string | null
          id: string
          notes: string | null
          open_rate: number | null
          organization_id: string
          scheduled_date: string | null
          status: string
          tema: string | null
          title: string
          titulo_email: string | null
          updated_at: string
        }
        Insert: {
          base?: string | null
          channel?: string
          click_rate?: number | null
          created_at?: string
          created_by: string
          custom_fields?: Json
          hora?: string | null
          id?: string
          notes?: string | null
          open_rate?: number | null
          organization_id: string
          scheduled_date?: string | null
          status?: string
          tema?: string | null
          title: string
          titulo_email?: string | null
          updated_at?: string
        }
        Update: {
          base?: string | null
          channel?: string
          click_rate?: number | null
          created_at?: string
          created_by?: string
          custom_fields?: Json
          hora?: string | null
          id?: string
          notes?: string | null
          open_rate?: number | null
          organization_id?: string
          scheduled_date?: string | null
          status?: string
          tema?: string | null
          title?: string
          titulo_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          metadata: Json
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_activity: {
        Row: {
          action: string
          created_at: string
          from_value: string | null
          id: string
          order_id: string
          to_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_value?: string | null
          id?: string
          order_id: string
          to_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_value?: string | null
          id?: string
          order_id?: string
          to_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_activity_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_activity_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_code_seq: {
        Row: {
          last_value: number
          organization_id: string
        }
        Insert: {
          last_value?: number
          organization_id: string
        }
        Update: {
          last_value?: number
          organization_id?: string
        }
        Relationships: []
      }
      order_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          order_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          order_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          order_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_comments_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_department_id: string | null
          assigned_to: string | null
          closed_at: string | null
          code: string | null
          created_at: string
          created_by: string
          customer_name: string | null
          description: string | null
          id: string
          notes: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["order_priority"]
          problem_type: Database["public"]["Enums"]["order_problem"]
          shopify_order: string | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          title: string
          totvs_order: string | null
          updated_at: string
        }
        Insert: {
          assigned_department_id?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          code?: string | null
          created_at?: string
          created_by: string
          customer_name?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          priority?: Database["public"]["Enums"]["order_priority"]
          problem_type?: Database["public"]["Enums"]["order_problem"]
          shopify_order?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          title: string
          totvs_order?: string | null
          updated_at?: string
        }
        Update: {
          assigned_department_id?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          code?: string | null
          created_at?: string
          created_by?: string
          customer_name?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["order_priority"]
          problem_type?: Database["public"]["Enums"]["order_problem"]
          shopify_order?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          title?: string
          totvs_order?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_department_id_fkey"
            columns: ["assigned_department_id"]
            isOneToOne: false
            referencedRelation: "org_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_assigned_to_profile_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_departments: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      org_positions: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          access_expires_at: string | null
          access_renewed_at: string | null
          access_renewed_by: string | null
          auth_block_reason: string | null
          auth_blocked_at: string | null
          auth_blocked_by: string | null
          created_at: string
          first_seen_at: string | null
          id: string
          invite_accepted_at: string | null
          invite_expires_at: string | null
          invite_last_sent_at: string | null
          invite_last_sent_by: string | null
          invite_sent_count: number
          invited_at: string | null
          last_seen_at: string | null
          last_seen_ip: string | null
          last_seen_user_agent: string | null
          organization_id: string
          role: string
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          user_id: string
        }
        Insert: {
          access_expires_at?: string | null
          access_renewed_at?: string | null
          access_renewed_by?: string | null
          auth_block_reason?: string | null
          auth_blocked_at?: string | null
          auth_blocked_by?: string | null
          created_at?: string
          first_seen_at?: string | null
          id?: string
          invite_accepted_at?: string | null
          invite_expires_at?: string | null
          invite_last_sent_at?: string | null
          invite_last_sent_by?: string | null
          invite_sent_count?: number
          invited_at?: string | null
          last_seen_at?: string | null
          last_seen_ip?: string | null
          last_seen_user_agent?: string | null
          organization_id: string
          role?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          user_id: string
        }
        Update: {
          access_expires_at?: string | null
          access_renewed_at?: string | null
          access_renewed_by?: string | null
          auth_block_reason?: string | null
          auth_blocked_at?: string | null
          auth_blocked_by?: string | null
          created_at?: string
          first_seen_at?: string | null
          id?: string
          invite_accepted_at?: string | null
          invite_expires_at?: string | null
          invite_last_sent_at?: string | null
          invite_last_sent_by?: string | null
          invite_sent_count?: number
          invited_at?: string | null
          last_seen_at?: string | null
          last_seen_ip?: string | null
          last_seen_user_agent?: string | null
          organization_id?: string
          role?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_access_renewed_by_fkey"
            columns: ["access_renewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_auth_blocked_by_fkey"
            columns: ["auth_blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_invite_last_sent_by_fkey"
            columns: ["invite_last_sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          color: string
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      pauta_activity: {
        Row: {
          action: string
          created_at: string
          from_value: string | null
          id: string
          pauta_id: string
          to_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_value?: string | null
          id?: string
          pauta_id: string
          to_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_value?: string | null
          id?: string
          pauta_id?: string
          to_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pauta_activity_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas"
            referencedColumns: ["id"]
          },
        ]
      }
      pauta_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          pauta_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          pauta_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          pauta_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pauta_comments_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas"
            referencedColumns: ["id"]
          },
        ]
      }
      pauta_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          custom_fields: Json
          id: string
          pauta_id: string
          position: number
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          custom_fields?: Json
          id?: string
          pauta_id: string
          position?: number
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          custom_fields?: Json
          id?: string
          pauta_id?: string
          position?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pauta_items_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas"
            referencedColumns: ["id"]
          },
        ]
      }
      pautas: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          custom_fields: Json
          id: string
          notes: string | null
          organization_id: string
          priority: string
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json
          id?: string
          notes?: string | null
          organization_id: string
          priority?: string
          scheduled_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json
          id?: string
          notes?: string | null
          organization_id?: string
          priority?: string
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pautas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          organization_id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          organization_id: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          organization_id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_activity: {
        Row: {
          action: string
          created_at: string
          from_value: string | null
          id: string
          produto_id: string
          to_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_value?: string | null
          id?: string
          produto_id: string
          to_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_value?: string | null
          id?: string
          produto_id?: string
          to_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produto_activity_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          produto_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          produto_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          produto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_attachments_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_code_seq: {
        Row: {
          last_value: number
          organization_id: string
        }
        Insert: {
          last_value?: number
          organization_id: string
        }
        Update: {
          last_value?: number
          organization_id?: string
        }
        Relationships: []
      }
      produto_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          produto_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          produto_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          produto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_comments_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_design_items: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          produto_id: string
          qt_variacoes: number | null
          status: string
          target_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          produto_id: string
          qt_variacoes?: number | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          produto_id?: string
          qt_variacoes?: number | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_design_items_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_stages: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          position: number
          produto_id: string
          stage_key: string
          status: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          position?: number
          produto_id: string
          stage_key: string
          status?: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          position?: number
          produto_id?: string
          stage_key?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_stages_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          code: string | null
          collection_group: string
          created_at: string
          created_by: string
          cronograma_end: string | null
          cronograma_start: string | null
          id: string
          launch_target: string | null
          name: string
          observations: string | null
          organization_id: string
          progress: number
          responsible: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          collection_group?: string
          created_at?: string
          created_by: string
          cronograma_end?: string | null
          cronograma_start?: string | null
          id?: string
          launch_target?: string | null
          name: string
          observations?: string | null
          organization_id: string
          progress?: number
          responsible?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          collection_group?: string
          created_at?: string
          created_by?: string
          cronograma_end?: string | null
          cronograma_start?: string | null
          id?: string
          launch_target?: string | null
          name?: string
          observations?: string | null
          organization_id?: string
          progress?: number
          responsible?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          position: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          position?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          position?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programacao_workspaces: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programacao_workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programacao_workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_columns: {
        Row: {
          column_type: string
          config: Json | null
          created_at: string
          id: string
          name: string
          position: number
          project_id: string
          width: number | null
        }
        Insert: {
          column_type?: string
          config?: Json | null
          created_at?: string
          id?: string
          name: string
          position?: number
          project_id: string
          width?: number | null
        }
        Update: {
          column_type?: string
          config?: Json | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          project_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_columns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_activity: {
        Row: {
          action: string
          created_at: string
          from_value: string | null
          id: string
          sessao_id: string
          to_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_value?: string | null
          id?: string
          sessao_id: string
          to_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_value?: string | null
          id?: string
          sessao_id?: string
          to_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessao_activity_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          sessao_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          sessao_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          sessao_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessao_attachments_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_code_seq: {
        Row: {
          last_value: number
          organization_id: string
        }
        Insert: {
          last_value?: number
          organization_id: string
        }
        Update: {
          last_value?: number
          organization_id?: string
        }
        Relationships: []
      }
      sessao_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          sessao_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sessao_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sessao_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessao_comments_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_contracts: {
        Row: {
          contract_end: string | null
          contract_start: string | null
          created_at: string
          created_by: string
          id: string
          monthly_quota_photos: number | null
          monthly_quota_videos: number | null
          notes: string | null
          organization_id: string
          photographer_name: string
          updated_at: string
        }
        Insert: {
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          created_by: string
          id?: string
          monthly_quota_photos?: number | null
          monthly_quota_videos?: number | null
          notes?: string | null
          organization_id: string
          photographer_name: string
          updated_at?: string
        }
        Update: {
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          created_by?: string
          id?: string
          monthly_quota_photos?: number | null
          monthly_quota_videos?: number | null
          notes?: string | null
          organization_id?: string
          photographer_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessao_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_ideas: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          organization_id: string
          status: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          organization_id: string
          status?: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          organization_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessao_ideas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_shots: {
        Row: {
          content_type: string | null
          created_at: string
          custom_fields: Json
          data_entrega: string | null
          funil: string | null
          id: string
          local: string | null
          modelo: string | null
          position: number
          sessao_id: string
          status: string
          tipo: string
          title: string
          updated_at: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          custom_fields?: Json
          data_entrega?: string | null
          funil?: string | null
          id?: string
          local?: string | null
          modelo?: string | null
          position?: number
          sessao_id: string
          status?: string
          tipo?: string
          title: string
          updated_at?: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          custom_fields?: Json
          data_entrega?: string | null
          funil?: string | null
          id?: string
          local?: string | null
          modelo?: string | null
          position?: number
          sessao_id?: string
          status?: string
          tipo?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessao_shots_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes: {
        Row: {
          code: string | null
          created_at: string
          created_by: string
          custom_fields: Json
          id: string
          notes: string | null
          organization_id: string
          professional: string | null
          responsaveis: string[] | null
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json
          id?: string
          notes?: string | null
          organization_id: string
          professional?: string | null
          responsaveis?: string[] | null
          scheduled_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json
          id?: string
          notes?: string | null
          organization_id?: string
          professional?: string | null
          responsaveis?: string[] | null
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          created_at: string
          end_date: string | null
          goal: string | null
          id: string
          is_active: boolean
          name: string
          project_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean
          name: string
          project_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity_log: {
        Row: {
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_log_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_custom_values: {
        Row: {
          column_id: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          column_id: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          column_id?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_custom_values_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "project_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_custom_values_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_label_assignments: {
        Row: {
          id: string
          label_id: string
          task_id: string
        }
        Insert: {
          id?: string
          label_id: string
          task_id: string
        }
        Update: {
          id?: string
          label_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "task_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_label_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          group_key: string | null
          id: string
          parent_task_id: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          sprint_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          ticket_number: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          group_key?: string | null
          id?: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          sprint_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          ticket_number?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          group_key?: string | null
          id?: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          sprint_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          ticket_number?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_activity: {
        Row: {
          action: string
          created_at: string
          from_value: string | null
          id: string
          ticket_id: string
          to_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_value?: string | null
          id?: string
          ticket_id: string
          to_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_value?: string | null
          id?: string
          ticket_id?: string
          to_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activity_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_activity_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_code_seq: {
        Row: {
          last_value: number
          organization_id: string
        }
        Insert: {
          last_value?: number
          organization_id: string
        }
        Update: {
          last_value?: number
          organization_id?: string
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_label_assignments: {
        Row: {
          created_at: string
          id: string
          label_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "ticket_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_label_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      ticket_sla_config: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          priority: string
          resolve_hours: number
          response_hours: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          priority: string
          resolve_hours?: number
          response_hours?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          priority?: string
          resolve_hours?: number
          response_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assigned_to: string | null
          category: string
          code: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          organization_id: string
          priority: string
          resolved_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          code?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          organization_id: string
          priority?: string
          resolved_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          code?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          organization_id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_profile_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_channel: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      get_dept_member_ids: {
        Args: { _dept_name: string; _org_id: string }
        Returns: {
          user_id: string
        }[]
      }
      get_or_create_dm: {
        Args: { _org_id: string; _other_user_id: string }
        Returns: string
      }
      has_min_role: {
        Args: {
          _min_role: Database["public"]["Enums"]["app_role"]
          _org_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_dept_manager: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      is_it_support: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      next_entity_code: {
        Args: { _entity_type: string; _org_id: string }
        Returns: number
      }
      notify_user: {
        Args: {
          _link?: string
          _message?: string
          _metadata?: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      process_access_governance_alerts: {
        Args: { _limit?: number }
        Returns: number
      }
      process_board_task_reminders: {
        Args: { _limit?: number }
        Returns: number
      }
      unread_count: {
        Args: { _channel_id: string; _user_id: string }
        Returns: number
      }
      user_has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "member"
        | "it_support"
        | "director"
        | "operator"
      order_priority: "low" | "medium" | "high" | "urgent"
      order_problem:
        | "furo_estoque"
        | "aguardando_itens"
        | "aguardar_envio"
        | "presente"
        | "troca"
        | "devolucao"
        | "endereco"
        | "outro"
      order_source: "expedicao" | "atendimento" | "marketing" | "outro"
      order_status:
        | "open"
        | "in_progress"
        | "waiting"
        | "sent"
        | "done"
        | "cancelled"
      project_status: "active" | "archived"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status: "backlog" | "todo" | "in_progress" | "in_review" | "done"
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
    Enums: {
      app_role: [
        "admin",
        "manager",
        "member",
        "it_support",
        "director",
        "operator",
      ],
      order_priority: ["low", "medium", "high", "urgent"],
      order_problem: [
        "furo_estoque",
        "aguardando_itens",
        "aguardar_envio",
        "presente",
        "troca",
        "devolucao",
        "endereco",
        "outro",
      ],
      order_source: ["expedicao", "atendimento", "marketing", "outro"],
      order_status: [
        "open",
        "in_progress",
        "waiting",
        "sent",
        "done",
        "cancelled",
      ],
      project_status: ["active", "archived"],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: ["backlog", "todo", "in_progress", "in_review", "done"],
    },
  },
} as const
