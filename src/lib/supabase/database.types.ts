
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_events": {
                  Row: {
                    "action": string,"created_at": string,"family_id": string | null,"id": number,"metadata": NonNullable<Json>,"target": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"family_id"?: string | null,"id"?: never,"metadata"?: NonNullable<Json>,"target"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"family_id"?: string | null,"id"?: never,"metadata"?: NonNullable<Json>,"target"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"behavior_entries": {
                  Row: {
                    "child_id": string,"count": number | null,"created_at": string,"day": string,"family_id": string,"id": string,"level_key": string | null,"note": string | null,"points": number,"recorded_by": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"count"?: number | null,"created_at"?: string,"day": string,"family_id": string,"id"?: string,"level_key"?: string | null,"note"?: string | null,"points"?: number,"recorded_by"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "child_id"?: string,"count"?: number | null,"created_at"?: string,"day"?: string,"family_id"?: string,"id"?: string,"level_key"?: string | null,"note"?: string | null,"points"?: number,"recorded_by"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "behavior_entries_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "behavior_entries_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"children": {
                  Row: {
                    "aliases": (string)[],"color": string,"created_at": string,"family_id": string,"first_name": string,"grade": string | null,"id": string,"school_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"color"?: string,"created_at"?: string,"family_id": string,"first_name": string,"grade"?: string | null,"id"?: string,"school_id"?: string | null
                  }
                  Update: {
                    "aliases"?: (string)[],"color"?: string,"created_at"?: string,"family_id"?: string,"first_name"?: string,"grade"?: string | null,"id"?: string,"school_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "children_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "children_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"extraction_candidates": {
                  Row: {
                    "all_day": boolean,"amount_cents": number | null,"category": Database["public"]['Enums']["item_category"],"child_id": string | null,"created_at": string,"details": string | null,"document_id": string,"due_at": string | null,"duplicate_of": string | null,"ends_at": string | null,"evidence": string | null,"family_id": string,"id": string,"kind": Database["public"]['Enums']["item_kind"],"location": string | null,"needs_review": boolean,"position": number,"review_reason": string | null,"school_id": string | null,"starts_at": string | null,"status": Database["public"]['Enums']["candidate_status"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "all_day"?: boolean,"amount_cents"?: number | null,"category"?: Database["public"]['Enums']["item_category"],"child_id"?: string | null,"created_at"?: string,"details"?: string | null,"document_id": string,"due_at"?: string | null,"duplicate_of"?: string | null,"ends_at"?: string | null,"evidence"?: string | null,"family_id": string,"id"?: string,"kind": Database["public"]['Enums']["item_kind"],"location"?: string | null,"needs_review"?: boolean,"position"?: number,"review_reason"?: string | null,"school_id"?: string | null,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["candidate_status"],"title": string
                  }
                  Update: {
                    "all_day"?: boolean,"amount_cents"?: number | null,"category"?: Database["public"]['Enums']["item_category"],"child_id"?: string | null,"created_at"?: string,"details"?: string | null,"document_id"?: string,"due_at"?: string | null,"duplicate_of"?: string | null,"ends_at"?: string | null,"evidence"?: string | null,"family_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["item_kind"],"location"?: string | null,"needs_review"?: boolean,"position"?: number,"review_reason"?: string | null,"school_id"?: string | null,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["candidate_status"],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "extraction_candidates_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "extraction_candidates_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "source_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "extraction_candidates_duplicate_fk"
      columns: ["duplicate_of"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "extraction_candidates_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "extraction_candidates_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
                  Row: {
                    "calendar_token": string,"context": NonNullable<Json>,"created_at": string,"created_by": string | null,"document_retention_days": number | null,"id": string,"name": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calendar_token"?: string,"context"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"document_retention_days"?: number | null,"id"?: string,"name": string,"timezone"?: string
                  }
                  Update: {
                    "calendar_token"?: string,"context"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"document_retention_days"?: number | null,"id"?: string,"name"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"family_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"family_id": string,"id": string,"invited_by": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"family_id": string,"id"?: string,"invited_by"?: string | null,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"family_id"?: string,"id"?: string,"invited_by"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_invites_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"family_members": {
                  Row: {
                    "created_at": string,"digest_enabled": boolean,"display_name": string,"email": string,"family_id": string,"last_digest_on": string | null,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"digest_enabled"?: boolean,"display_name": string,"email": string,"family_id": string,"last_digest_on"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"digest_enabled"?: boolean,"display_name"?: string,"email"?: string,"family_id"?: string,"last_digest_on"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"family_platforms": {
                  Row: {
                    "child_ids": (string)[],"created_at": string,"family_id": string,"id": string,"notes": string | null,"notification_channels": (string)[],"platform_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_ids"?: (string)[],"created_at"?: string,"family_id": string,"id"?: string,"notes"?: string | null,"notification_channels"?: (string)[],"platform_key": string
                  }
                  Update: {
                    "child_ids"?: (string)[],"created_at"?: string,"family_id"?: string,"id"?: string,"notes"?: string | null,"notification_channels"?: (string)[],"platform_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_platforms_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"gmail_connections": {
                  Row: {
                    "created_at": string,"family_id": string,"google_email": string,"id": string,"last_error": string | null,"last_success_at": string | null,"last_sync_at": string | null,"messages_seen": number,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"family_id": string,"google_email": string,"id"?: string,"last_error"?: string | null,"last_success_at"?: string | null,"last_sync_at"?: string | null,"messages_seen"?: number,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string,"google_email"?: string,"id"?: string,"last_error"?: string | null,"last_success_at"?: string | null,"last_sync_at"?: string | null,"messages_seen"?: number,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gmail_connections_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"ingest_tokens": {
                  Row: {
                    "created_at": string,"family_id": string,"id": string,"label": string,"last_used_at": string | null,"token_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"family_id": string,"id"?: string,"label"?: string,"last_used_at"?: string | null,"token_hash": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string,"id"?: string,"label"?: string,"last_used_at"?: string | null,"token_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingest_tokens_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"integration_secrets": {
                  Row: {
                    "ciphertext": string,"created_at": string,"family_id": string,"id": string,"kind": string,"owner_ref": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ciphertext": string,"created_at"?: string,"family_id": string,"id"?: string,"kind": string,"owner_ref": string,"updated_at"?: string
                  }
                  Update: {
                    "ciphertext"?: string,"created_at"?: string,"family_id"?: string,"id"?: string,"kind"?: string,"owner_ref"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "integration_secrets_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"item_sources": {
                  Row: {
                    "created_at": string,"document_id": string,"evidence": string | null,"family_id": string,"item_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"document_id": string,"evidence"?: string | null,"family_id": string,"item_id": string
                  }
                  Update: {
                    "created_at"?: string,"document_id"?: string,"evidence"?: string | null,"family_id"?: string,"item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_sources_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "source_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_sources_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_sources_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    }
                  ]
                },"items": {
                  Row: {
                    "all_day": boolean,"amount_cents": number | null,"assignee_id": string | null,"category": Database["public"]['Enums']["item_category"],"child_id": string | null,"completed_at": string | null,"completed_by": string | null,"created_at": string,"created_by": string | null,"details": string | null,"due_at": string | null,"ends_at": string | null,"family_id": string,"id": string,"kind": Database["public"]['Enums']["item_kind"],"location": string | null,"school_id": string | null,"starts_at": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "all_day"?: boolean,"amount_cents"?: number | null,"assignee_id"?: string | null,"category"?: Database["public"]['Enums']["item_category"],"child_id"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"details"?: string | null,"due_at"?: string | null,"ends_at"?: string | null,"family_id": string,"id"?: string,"kind": Database["public"]['Enums']["item_kind"],"location"?: string | null,"school_id"?: string | null,"starts_at"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "all_day"?: boolean,"amount_cents"?: number | null,"assignee_id"?: string | null,"category"?: Database["public"]['Enums']["item_category"],"child_id"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"details"?: string | null,"due_at"?: string | null,"ends_at"?: string | null,"family_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["item_kind"],"location"?: string | null,"school_id"?: string | null,"starts_at"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"member_phones": {
                  Row: {
                    "code_expires_at": string | null,"created_at": string,"family_id": string,"id": string,"phone_e164": string | null,"user_id": string,"verification_code": string | null,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code_expires_at"?: string | null,"created_at"?: string,"family_id": string,"id"?: string,"phone_e164"?: string | null,"user_id": string,"verification_code"?: string | null,"verified_at"?: string | null
                  }
                  Update: {
                    "code_expires_at"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"phone_e164"?: string | null,"user_id"?: string,"verification_code"?: string | null,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_phones_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"rewards": {
                  Row: {
                    "child_id": string,"claimed_at": string | null,"created_at": string,"family_id": string,"horizon": string,"id": string,"points_goal": number,"starts_on": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"claimed_at"?: string | null,"created_at"?: string,"family_id": string,"horizon": string,"id"?: string,"points_goal": number,"starts_on"?: string,"title": string
                  }
                  Update: {
                    "child_id"?: string,"claimed_at"?: string | null,"created_at"?: string,"family_id"?: string,"horizon"?: string,"id"?: string,"points_goal"?: number,"starts_on"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rewards_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rewards_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"schools": {
                  Row: {
                    "calendar_url": string | null,"created_at": string,"family_id": string,"id": string,"name": string,"short_name": string | null,"town": string | null,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "calendar_url"?: string | null,"created_at"?: string,"family_id": string,"id"?: string,"name": string,"short_name"?: string | null,"town"?: string | null,"website"?: string | null
                  }
                  Update: {
                    "calendar_url"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"name"?: string,"short_name"?: string | null,"town"?: string | null,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "schools_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"sender_rules": {
                  Row: {
                    "child_id": string | null,"created_at": string,"family_id": string,"id": string,"pattern": string,"platform_key": string | null,"school_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id"?: string | null,"created_at"?: string,"family_id": string,"id"?: string,"pattern": string,"platform_key"?: string | null,"school_id"?: string | null
                  }
                  Update: {
                    "child_id"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"pattern"?: string,"platform_key"?: string | null,"school_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sender_rules_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sender_rules_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sender_rules_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"source_documents": {
                  Row: {
                    "ai_summary": string | null,"batch_id": string,"channel": Database["public"]['Enums']["channel"],"child_hint_id": string | null,"content_hash": string,"created_at": string,"error": string | null,"family_id": string,"id": string,"is_school_related": boolean | null,"mime_type": string | null,"origin_ref": string | null,"platform_key": string | null,"processed_at": string | null,"received_at": string,"school_hint_id": string | null,"sender": string | null,"status": Database["public"]['Enums']["document_status"],"storage_path": string | null,"submitted_by": string | null,"text_content": string | null,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_summary"?: string | null,"batch_id"?: string,"channel": Database["public"]['Enums']["channel"],"child_hint_id"?: string | null,"content_hash": string,"created_at"?: string,"error"?: string | null,"family_id": string,"id"?: string,"is_school_related"?: boolean | null,"mime_type"?: string | null,"origin_ref"?: string | null,"platform_key"?: string | null,"processed_at"?: string | null,"received_at"?: string,"school_hint_id"?: string | null,"sender"?: string | null,"status"?: Database["public"]['Enums']["document_status"],"storage_path"?: string | null,"submitted_by"?: string | null,"text_content"?: string | null,"title"?: string | null
                  }
                  Update: {
                    "ai_summary"?: string | null,"batch_id"?: string,"channel"?: Database["public"]['Enums']["channel"],"child_hint_id"?: string | null,"content_hash"?: string,"created_at"?: string,"error"?: string | null,"family_id"?: string,"id"?: string,"is_school_related"?: boolean | null,"mime_type"?: string | null,"origin_ref"?: string | null,"platform_key"?: string | null,"processed_at"?: string | null,"received_at"?: string,"school_hint_id"?: string | null,"sender"?: string | null,"status"?: Database["public"]['Enums']["document_status"],"storage_path"?: string | null,"submitted_by"?: string | null,"text_content"?: string | null,"title"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_documents_child_hint_id_fkey"
      columns: ["child_hint_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "source_documents_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "source_documents_school_hint_id_fkey"
      columns: ["school_hint_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"tracking_systems": {
                  Row: {
                    "check_in_time": string | null,"child_id": string,"count_max": number | null,"count_points": Json | null,"count_unit": string | null,"created_at": string,"description": string | null,"family_id": string,"id": string,"kind": string,"levels": NonNullable<Json>,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "check_in_time"?: string | null,"child_id": string,"count_max"?: number | null,"count_points"?: Json | null,"count_unit"?: string | null,"created_at"?: string,"description"?: string | null,"family_id": string,"id"?: string,"kind": string,"levels"?: NonNullable<Json>,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "check_in_time"?: string | null,"child_id"?: string,"count_max"?: number | null,"count_points"?: Json | null,"count_unit"?: string | null,"created_at"?: string,"description"?: string | null,"family_id"?: string,"id"?: string,"kind"?: string,"levels"?: NonNullable<Json>,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tracking_systems_child_id_fkey"
      columns: ["child_id"]
isOneToOne: true
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tracking_systems_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_display_name": string,"p_token": string }; Returns: string
                           },
"create_family":
{ Args: { "p_display_name": string,"p_name": string,"p_timezone": string }; Returns: string
                           },
"invite_preview":
{ Args: { "p_token": string }; Returns: {
              "email": string,"expired": boolean,"family_name": string,"used": boolean
            }[]
                           },
"is_family_member":
{ Args: { "fid": string }; Returns: boolean
                           },
"is_family_owner":
{ Args: { "fid": string }; Returns: boolean
                           }
          }
          Enums: {
            "candidate_status": "pending"|"approved"|"rejected","channel": "upload"|"paste"|"share"|"gmail"|"sms"|"manual"|"web","document_status": "pending"|"processing"|"needs_review"|"done"|"failed"|"ignored","item_category": "general"|"closure"|"early_dismissal"|"supplies"|"permission_form"|"payment"|"lunch"|"teacher_request"|"activity"|"reminder","item_kind": "event"|"task"|"announcement","member_role": "owner"|"parent"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "candidate_status": ["pending", "approved", "rejected"],"channel": ["upload", "paste", "share", "gmail", "sms", "manual", "web"],"document_status": ["pending", "processing", "needs_review", "done", "failed", "ignored"],"item_category": ["general", "closure", "early_dismissal", "supplies", "permission_form", "payment", "lunch", "teacher_request", "activity", "reminder"],"item_kind": ["event", "task", "announcement"],"member_role": ["owner", "parent"]
          }
        }
} as const
