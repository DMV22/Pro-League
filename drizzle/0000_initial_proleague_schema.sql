CREATE SCHEMA IF NOT EXISTS "app";
--> statement-breakpoint
CREATE TABLE "app"."competition_format_activations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	"format_version_id" uuid NOT NULL,
	"replaced_activation_id" uuid,
	"actor_id" uuid NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	CONSTRAINT "competition_format_activations_version_uq" UNIQUE("format_version_id")
);
--> statement-breakpoint
CREATE TABLE "app"."competition_format_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"format_id" uuid NOT NULL,
	"editing_context" text NOT NULL,
	"base_version_id" uuid,
	"validation_state" text DEFAULT 'unvalidated' NOT NULL,
	"validation_hash" text,
	CONSTRAINT "competition_format_drafts_context_uq" UNIQUE("format_id","editing_context")
);
--> statement-breakpoint
CREATE TABLE "app"."competition_format_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"format_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content_hash" text NOT NULL,
	"source_draft_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	CONSTRAINT "competition_format_versions_number_uq" UNIQUE("format_id","version_number"),
	CONSTRAINT "competition_format_versions_season_id_uq" UNIQUE("season_id","id"),
	CONSTRAINT "competition_format_versions_number_ck" CHECK ("app"."competition_format_versions"."version_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."competition_formats" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	CONSTRAINT "competition_formats_season_uq" UNIQUE("season_id")
);
--> statement-breakpoint
CREATE TABLE "app"."competition_profile_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"competition_id" uuid NOT NULL,
	"official_name" text NOT NULL,
	"short_name" text,
	"description" text,
	"logo_media_asset_id" uuid,
	"correction_reason" text,
	"author_id" uuid NOT NULL,
	CONSTRAINT "competition_profile_versions_owner_id_uq" UNIQUE("competition_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."competition_slugs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"competition_id" uuid NOT NULL,
	"display_slug" text NOT NULL,
	"normalized_slug" text NOT NULL,
	"valid_from_at" timestamp with time zone NOT NULL,
	CONSTRAINT "competition_slugs_owner_id_uq" UNIQUE("competition_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."competition_stage_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"format_version_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"format_type" text NOT NULL,
	"grouping_mode" text,
	"configuration_hash" text NOT NULL,
	CONSTRAINT "competition_stage_versions_order_uq" UNIQUE("format_version_id","position"),
	CONSTRAINT "competition_stage_versions_stage_id_uq" UNIQUE("stage_id","id"),
	CONSTRAINT "competition_stage_versions_type_ck" CHECK ("app"."competition_stage_versions"."format_type" in ('league', 'knockout')),
	CONSTRAINT "competition_stage_versions_position_ck" CHECK ("app"."competition_stage_versions"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."competition_stages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	"code" text NOT NULL,
	"sporting_state" text DEFAULT 'configuring' NOT NULL,
	"current_version_id" uuid,
	"current_final_standings_snapshot_id" uuid,
	"current_final_knockout_snapshot_id" uuid,
	CONSTRAINT "competition_stages_season_code_uq" UNIQUE("season_id","code"),
	CONSTRAINT "competition_stages_state_ck" CHECK ("app"."competition_stages"."sporting_state" in ('configuring', 'ready', 'active', 'awaiting_finalization', 'finalized', 'removed', 'abandoned')),
	CONSTRAINT "competition_stages_final_snapshot_ck" CHECK (("app"."competition_stages"."sporting_state" = 'finalized') = (num_nonnulls("app"."competition_stages"."current_final_standings_snapshot_id", "app"."competition_stages"."current_final_knockout_snapshot_id") = 1))
);
--> statement-breakpoint
CREATE TABLE "app"."competitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"archive_state" text DEFAULT 'active' NOT NULL,
	"current_slug_id" uuid,
	"current_profile_version_id" uuid,
	"current_season_id" uuid,
	CONSTRAINT "competitions_visibility_ck" CHECK ("app"."competitions"."visibility" in ('private', 'public')),
	CONSTRAINT "competitions_archive_state_ck" CHECK ("app"."competitions"."archive_state" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "app"."current_season_designations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"competition_id" uuid NOT NULL,
	"previous_season_id" uuid,
	"selected_season_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"effective_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."format_amendment_stages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amendment_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"effect" text NOT NULL,
	CONSTRAINT "format_amendment_stages_stage_uq" UNIQUE("amendment_id","stage_id"),
	CONSTRAINT "format_amendment_stages_effect_ck" CHECK ("app"."format_amendment_stages"."effect" in ('changed', 'added', 'removed', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "app"."format_amendment_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amendment_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"activated_version_id" uuid,
	CONSTRAINT "format_amendment_transitions_state_ck" CHECK ("app"."format_amendment_transitions"."to_state" in ('preparing', 'validated', 'applied', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "app"."format_amendments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	"base_version_id" uuid NOT NULL,
	"target_draft_id" uuid NOT NULL,
	"applied_version_id" uuid,
	"state" text DEFAULT 'preparing' NOT NULL,
	"reason" text NOT NULL,
	"supporting_reference_id" uuid,
	CONSTRAINT "format_amendments_state_ck" CHECK ("app"."format_amendments"."state" in ('preparing', 'validated', 'applied', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_dependencies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"draft_id" uuid NOT NULL,
	"source_stage_id" uuid NOT NULL,
	"source_output_code" text NOT NULL,
	"destination_slot_id" uuid NOT NULL,
	CONSTRAINT "format_draft_dependencies_destination_uq" UNIQUE("destination_slot_id")
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_draw_constraints" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"draw_pool_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_pot_id" uuid,
	"target_pot_id" uuid,
	"parameter" text
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_draw_pools" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"draft_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "format_draft_draw_pools_code_uq" UNIQUE("stage_id","code")
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_draw_pots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"draw_pool_id" uuid NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "format_draft_draw_pots_code_uq" UNIQUE("draw_pool_id","code")
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_knockout_rounds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	"draw_mode" text NOT NULL,
	"leg_count" integer NOT NULL,
	CONSTRAINT "format_draft_knockout_rounds_code_uq" UNIQUE("stage_id","code"),
	CONSTRAINT "format_draft_knockout_rounds_position_uq" UNIQUE("stage_id","position"),
	CONSTRAINT "format_draft_knockout_rounds_leg_count_ck" CHECK ("app"."format_draft_knockout_rounds"."leg_count" in (1, 2)),
	CONSTRAINT "format_draft_knockout_rounds_draw_mode_ck" CHECK ("app"."format_draft_knockout_rounds"."draw_mode" in ('fixed', 'redraw'))
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_knockout_ties" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"round_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"placement_kind" text,
	"winner_destination_slot_id" uuid,
	CONSTRAINT "format_draft_knockout_ties_position_uq" UNIQUE("round_id","position"),
	CONSTRAINT "format_draft_knockout_ties_placement_ck" CHECK ("app"."format_draft_knockout_ties"."placement_kind" is null or "app"."format_draft_knockout_ties"."placement_kind" in ('final', 'third_place'))
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_participant_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"group_id" uuid,
	"slot_code" text NOT NULL,
	"position" integer NOT NULL,
	"source_kind" text NOT NULL,
	"source_season_entry_id" uuid,
	"source_stage_id" uuid,
	"source_output_code" text,
	CONSTRAINT "format_draft_participant_slots_code_uq" UNIQUE("stage_id","slot_code"),
	CONSTRAINT "format_draft_participant_slots_position_uq" UNIQUE("stage_id","position")
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_points_schemes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ranking_rule_set_id" uuid NOT NULL,
	"win_points" integer DEFAULT 3 NOT NULL,
	"draw_points" integer DEFAULT 1 NOT NULL,
	"loss_points" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "format_draft_points_scheme_rule_uq" UNIQUE("ranking_rule_set_id")
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_qualification_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_stage_id" uuid NOT NULL,
	"source_group_id" uuid,
	"rank_from" integer NOT NULL,
	"rank_through" integer NOT NULL,
	"destination_slot_id" uuid,
	"destination_draw_pool_id" uuid,
	CONSTRAINT "format_draft_qualification_rank_ck" CHECK ("app"."format_draft_qualification_rules"."rank_from" > 0 and "app"."format_draft_qualification_rules"."rank_through" >= "app"."format_draft_qualification_rules"."rank_from"),
	CONSTRAINT "format_draft_qualification_destination_ck" CHECK (("app"."format_draft_qualification_rules"."destination_slot_id" is null) <> ("app"."format_draft_qualification_rules"."destination_draw_pool_id" is null))
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_ranking_rule_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"name" text NOT NULL,
	"fair_play_enabled" boolean DEFAULT false NOT NULL,
	"yellow_card_weight" integer,
	"second_yellow_card_weight" integer,
	"direct_red_card_weight" integer,
	CONSTRAINT "format_draft_ranking_stage_uq" UNIQUE("stage_id"),
	CONSTRAINT "format_draft_ranking_weights_ck" CHECK (("app"."format_draft_ranking_rule_sets"."yellow_card_weight" is null or "app"."format_draft_ranking_rule_sets"."yellow_card_weight" >= 0) and ("app"."format_draft_ranking_rule_sets"."second_yellow_card_weight" is null or "app"."format_draft_ranking_rule_sets"."second_yellow_card_weight" >= 0) and ("app"."format_draft_ranking_rule_sets"."direct_red_card_weight" is null or "app"."format_draft_ranking_rule_sets"."direct_red_card_weight" >= 0))
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_resolution_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"round_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"step_type" text NOT NULL,
	CONSTRAINT "format_draft_resolution_steps_position_uq" UNIQUE("round_id","position"),
	CONSTRAINT "format_draft_resolution_steps_type_ck" CHECK ("app"."format_draft_resolution_steps"."step_type" in ('aggregate', 'regulation', 'extra_time', 'replay', 'penalties'))
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_stage_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "format_draft_stage_groups_code_uq" UNIQUE("stage_id","code"),
	CONSTRAINT "format_draft_stage_groups_position_uq" UNIQUE("stage_id","position")
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_stages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"draft_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	"format_type" text NOT NULL,
	"grouping_mode" text,
	CONSTRAINT "format_draft_stages_code_uq" UNIQUE("draft_id","code"),
	CONSTRAINT "format_draft_stages_position_uq" UNIQUE("draft_id","position"),
	CONSTRAINT "format_draft_stages_type_ck" CHECK ("app"."format_draft_stages"."format_type" in ('league', 'knockout')),
	CONSTRAINT "format_draft_stages_position_ck" CHECK ("app"."format_draft_stages"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_tie_breakers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ranking_rule_set_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"criterion" text NOT NULL,
	"direction" text NOT NULL,
	CONSTRAINT "format_draft_tie_breakers_position_uq" UNIQUE("ranking_rule_set_id","position"),
	CONSTRAINT "format_draft_tie_breakers_direction_ck" CHECK ("app"."format_draft_tie_breakers"."direction" in ('asc', 'desc'))
);
--> statement-breakpoint
CREATE TABLE "app"."format_draft_tie_participant_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tie_id" uuid NOT NULL,
	"side" text NOT NULL,
	"source_slot_id" uuid,
	"source_draw_pool_id" uuid,
	CONSTRAINT "format_draft_tie_participant_side_uq" UNIQUE("tie_id","side"),
	CONSTRAINT "format_draft_tie_participant_side_ck" CHECK ("app"."format_draft_tie_participant_slots"."side" in ('home', 'away')),
	CONSTRAINT "format_draft_tie_participant_source_ck" CHECK (("app"."format_draft_tie_participant_slots"."source_slot_id" is null) <> ("app"."format_draft_tie_participant_slots"."source_draw_pool_id" is null))
);
--> statement-breakpoint
CREATE TABLE "app"."format_template_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"template_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"blueprint_schema_version" integer NOT NULL,
	"blueprint" jsonb NOT NULL,
	"validation_hash" text NOT NULL,
	"author_id" uuid NOT NULL,
	CONSTRAINT "format_template_versions_number_uq" UNIQUE("template_id","version_number"),
	CONSTRAINT "format_template_versions_number_ck" CHECK ("app"."format_template_versions"."version_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."format_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"archive_state" text DEFAULT 'active' NOT NULL,
	"current_version_id" uuid,
	CONSTRAINT "format_templates_archive_state_ck" CHECK ("app"."format_templates"."archive_state" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "app"."season_archive_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."season_slugs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"competition_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"display_slug" text NOT NULL,
	"normalized_slug" text NOT NULL,
	"valid_from_at" timestamp with time zone NOT NULL,
	CONSTRAINT "season_slugs_owner_id_uq" UNIQUE("season_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."season_state_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"related_ruling_id" uuid,
	"related_amendment_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."season_visibility_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	"from_visibility" text NOT NULL,
	"to_visibility" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."seasons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"competition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"current_slug_id" uuid,
	"timezone" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"sporting_state" text DEFAULT 'preparing' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"archive_state" text DEFAULT 'active' NOT NULL,
	"current_format_version_id" uuid,
	CONSTRAINT "seasons_competition_id_id_uq" UNIQUE("competition_id","id"),
	CONSTRAINT "seasons_sporting_state_ck" CHECK ("app"."seasons"."sporting_state" in ('preparing', 'active', 'completed', 'cancelled', 'abandoned')),
	CONSTRAINT "seasons_visibility_ck" CHECK ("app"."seasons"."visibility" in ('private', 'public')),
	CONSTRAINT "seasons_archive_state_ck" CHECK ("app"."seasons"."archive_state" in ('active', 'archived')),
	CONSTRAINT "seasons_date_order_ck" CHECK ("app"."seasons"."ends_on" is null or "app"."seasons"."starts_on" is null or "app"."seasons"."ends_on" >= "app"."seasons"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "app"."stage_dependencies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"format_version_id" uuid NOT NULL,
	"source_stage_id" uuid NOT NULL,
	"source_output_code" text NOT NULL,
	"destination_stage_id" uuid NOT NULL,
	"destination_slot_code" text NOT NULL,
	CONSTRAINT "stage_dependencies_destination_uq" UNIQUE("format_version_id","destination_stage_id","destination_slot_code"),
	CONSTRAINT "stage_dependencies_no_self_ck" CHECK ("app"."stage_dependencies"."source_stage_id" <> "app"."stage_dependencies"."destination_stage_id")
);
--> statement-breakpoint
CREATE TABLE "app"."stage_group_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_version_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "stage_group_versions_group_uq" UNIQUE("stage_version_id","group_id"),
	CONSTRAINT "stage_group_versions_code_uq" UNIQUE("stage_version_id","code"),
	CONSTRAINT "stage_group_versions_position_uq" UNIQUE("stage_version_id","position")
);
--> statement-breakpoint
CREATE TABLE "app"."stage_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"stable_code" text NOT NULL,
	CONSTRAINT "stage_groups_code_uq" UNIQUE("stage_id","stable_code")
);
--> statement-breakpoint
CREATE TABLE "app"."stage_state_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"amendment_id" uuid,
	"result_ruling_id" uuid,
	"qualification_ruling_id" uuid,
	"ranking_ruling_id" uuid,
	"tie_ruling_id" uuid,
	CONSTRAINT "stage_state_transitions_one_ruling_ck" CHECK (num_nonnulls("app"."stage_state_transitions"."result_ruling_id", "app"."stage_state_transitions"."qualification_ruling_id", "app"."stage_state_transitions"."ranking_ruling_id", "app"."stage_state_transitions"."tie_ruling_id") <= 1)
);
--> statement-breakpoint
CREATE TABLE "app"."article_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"normalized_slug" text NOT NULL,
	"archive_state" text DEFAULT 'active' NOT NULL,
	"current_version_id" uuid,
	CONSTRAINT "article_categories_archive_ck" CHECK ("app"."article_categories"."archive_state" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "app"."article_category_state_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."article_category_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"reason" text,
	"actor_id" uuid NOT NULL,
	"supersedes_version_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."article_competition_associations_revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	CONSTRAINT "article_competition_revision_uq" UNIQUE("revision_id","competition_id")
);
--> statement-breakpoint
CREATE TABLE "app"."article_competition_associations_working" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"working_copy_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	CONSTRAINT "article_competition_working_uq" UNIQUE("working_copy_id","competition_id")
);
--> statement-breakpoint
CREATE TABLE "app"."article_match_associations_revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	CONSTRAINT "article_match_revision_uq" UNIQUE("revision_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "app"."article_match_associations_working" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"working_copy_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	CONSTRAINT "article_match_working_uq" UNIQUE("working_copy_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "app"."article_media_placements_revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"presentation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"position" integer NOT NULL,
	"alt_text" text,
	"caption" text,
	"decorative" boolean NOT NULL,
	"attribution_snapshot" text,
	CONSTRAINT "article_media_placements_revision_position_uq" UNIQUE("revision_id","role","position"),
	CONSTRAINT "article_media_placements_revision_position_ck" CHECK ("app"."article_media_placements_revision"."position" > 0),
	CONSTRAINT "article_media_placements_revision_alt_ck" CHECK ("app"."article_media_placements_revision"."decorative" or nullif(btrim("app"."article_media_placements_revision"."alt_text"), '') is not null)
);
--> statement-breakpoint
CREATE TABLE "app"."article_media_placements_working" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"working_copy_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"presentation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"position" integer NOT NULL,
	"alt_text" text,
	"caption" text,
	"decorative" boolean DEFAULT false NOT NULL,
	CONSTRAINT "article_media_placements_working_position_uq" UNIQUE("working_copy_id","role","position"),
	CONSTRAINT "article_media_placements_working_role_ck" CHECK ("app"."article_media_placements_working"."role" in ('cover', 'inline')),
	CONSTRAINT "article_media_placements_working_position_ck" CHECK ("app"."article_media_placements_working"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."article_player_associations_revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	CONSTRAINT "article_player_revision_uq" UNIQUE("revision_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "app"."article_player_associations_working" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"working_copy_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	CONSTRAINT "article_player_working_uq" UNIQUE("working_copy_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "app"."article_publication_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"article_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"working_copy_id" uuid NOT NULL,
	"expected_working_version" bigint NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_failure_reason" text,
	CONSTRAINT "article_publication_schedules_state_ck" CHECK ("app"."article_publication_schedules"."state" in ('pending', 'processing', 'published', 'failed', 'cancelled')),
	CONSTRAINT "article_publication_schedules_attempts_ck" CHECK ("app"."article_publication_schedules"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."article_recovery_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"working_copy_id" uuid NOT NULL,
	"working_version" bigint NOT NULL,
	"body" jsonb NOT NULL,
	"content_schema_version" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."article_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"article_id" uuid NOT NULL,
	"slug_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"category_name_snapshot" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" jsonb NOT NULL,
	"content_schema_version" integer NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"content_hash" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"author_id" uuid NOT NULL,
	"internal_reason" text,
	"public_correction_explanation" text,
	"supersedes_revision_id" uuid,
	CONSTRAINT "article_revisions_owner_id_uq" UNIQUE("article_id","id"),
	CONSTRAINT "article_revisions_schema_ck" CHECK ("app"."article_revisions"."content_schema_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."article_season_associations_revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	CONSTRAINT "article_season_revision_uq" UNIQUE("revision_id","season_id")
);
--> statement-breakpoint
CREATE TABLE "app"."article_season_associations_working" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"working_copy_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	CONSTRAINT "article_season_working_uq" UNIQUE("working_copy_id","season_id")
);
--> statement-breakpoint
CREATE TABLE "app"."article_slugs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"article_id" uuid NOT NULL,
	"display_slug" text NOT NULL,
	"normalized_slug" text NOT NULL,
	"valid_from_at" timestamp with time zone NOT NULL,
	CONSTRAINT "article_slugs_owner_id_uq" UNIQUE("article_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."article_state_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"article_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"publication_schedule_id" uuid,
	"published_revision_id" uuid,
	"reason" text,
	"actor_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."article_team_associations_revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	CONSTRAINT "article_team_revision_uq" UNIQUE("revision_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "app"."article_team_associations_working" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"working_copy_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	CONSTRAINT "article_team_working_uq" UNIQUE("working_copy_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "app"."article_working_copies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"article_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" jsonb NOT NULL,
	"content_schema_version" integer NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"category_id" uuid NOT NULL,
	"proposed_slug" text NOT NULL,
	"validation_state" text DEFAULT 'incomplete' NOT NULL,
	"recovery_version" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "article_working_copies_schema_ck" CHECK ("app"."article_working_copies"."content_schema_version" > 0),
	CONSTRAINT "article_working_copies_recovery_ck" CHECK ("app"."article_working_copies"."recovery_version" > 0),
	CONSTRAINT "article_working_copies_validation_ck" CHECK ("app"."article_working_copies"."validation_state" in ('incomplete', 'valid', 'invalid'))
);
--> statement-breakpoint
CREATE TABLE "app"."featured_article_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"article_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"reason" text,
	"actor_id" uuid NOT NULL,
	"supersedes_decision_id" uuid,
	CONSTRAINT "featured_article_decisions_type_ck" CHECK ("app"."featured_article_decisions"."decision" in ('feature', 'unfeature')),
	CONSTRAINT "featured_article_decisions_period_ck" CHECK ("app"."featured_article_decisions"."ends_at" is null or "app"."featured_article_decisions"."ends_at" > "app"."featured_article_decisions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "app"."news_articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lifecycle_state" text DEFAULT 'draft' NOT NULL,
	"first_published_at" timestamp with time zone,
	"original_published_at" timestamp with time zone,
	"current_working_copy_id" uuid,
	"current_published_revision_id" uuid,
	"current_slug_id" uuid,
	"author_id" uuid NOT NULL,
	CONSTRAINT "news_articles_state_ck" CHECK ("app"."news_articles"."lifecycle_state" in ('draft', 'scheduled', 'published', 'archived')),
	CONSTRAINT "news_articles_publication_ck" CHECK ("app"."news_articles"."current_published_revision_id" is null or "app"."news_articles"."first_published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "app"."audit_event_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"audit_event_id" uuid NOT NULL,
	"schema_version" integer NOT NULL,
	"redacted_diff" jsonb,
	"revision_type" text,
	"revision_id" uuid,
	CONSTRAINT "audit_event_changes_source_ck" CHECK (("app"."audit_event_changes"."redacted_diff" is not null) <> ("app"."audit_event_changes"."revision_id" is not null)),
	CONSTRAINT "audit_event_changes_revision_ck" CHECK ("app"."audit_event_changes"."revision_id" is null or "app"."audit_event_changes"."revision_type" is not null),
	CONSTRAINT "audit_event_changes_schema_ck" CHECK ("app"."audit_event_changes"."schema_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."audit_event_targets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"audit_event_id" uuid NOT NULL,
	"role" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"target_version" bigint,
	"display_snapshot" text,
	CONSTRAINT "audit_event_targets_role_ck" CHECK ("app"."audit_event_targets"."role" in ('primary', 'related', 'affected'))
);
--> statement-breakpoint
CREATE TABLE "app"."audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sequence_number" bigint GENERATED ALWAYS AS IDENTITY (sequence name "app"."audit_events_sequence_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_kind" text NOT NULL,
	"actor_admin_identity_id" uuid,
	"actor_display_snapshot" text NOT NULL,
	"actor_email_snapshot" text,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"source" text NOT NULL,
	"correlation_key" text,
	"command_key" text,
	CONSTRAINT "audit_events_sequence_uq" UNIQUE("sequence_number"),
	CONSTRAINT "audit_events_actor_ck" CHECK ("app"."audit_events"."actor_kind" in ('admin', 'system', 'operator')),
	CONSTRAINT "audit_events_outcome_ck" CHECK ("app"."audit_events"."outcome" in ('succeeded', 'denied', 'failed', 'requested'))
);
--> statement-breakpoint
CREATE TABLE "app"."legal_hold_targets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hold_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"scope" text NOT NULL,
	CONSTRAINT "legal_hold_targets_scope_uq" UNIQUE("hold_id","target_type","target_id"),
	CONSTRAINT "legal_hold_targets_scope_ck" CHECK ("app"."legal_hold_targets"."scope" in ('direct', 'enclosing'))
);
--> statement-breakpoint
CREATE TABLE "app"."legal_holds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"released_by_id" uuid,
	"released_at" timestamp with time zone,
	CONSTRAINT "legal_holds_state_ck" CHECK ("app"."legal_holds"."state" in ('active', 'released'))
);
--> statement-breakpoint
CREATE TABLE "app"."privacy_deletion_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" uuid NOT NULL,
	"opaque_target_hash" text NOT NULL,
	"hash_key_version" integer NOT NULL,
	"action" text NOT NULL,
	"applied_at" timestamp with time zone NOT NULL,
	"reapplies_ledger_id" uuid,
	CONSTRAINT "privacy_deletion_ledger_key_version_ck" CHECK ("app"."privacy_deletion_ledger"."hash_key_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."privacy_request_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_item_id" uuid NOT NULL,
	"action" text NOT NULL,
	"decision_reason" text NOT NULL,
	"completed_at" timestamp with time zone,
	"evidence_reference_id" uuid,
	"actor_id" uuid NOT NULL,
	CONSTRAINT "privacy_request_actions_type_ck" CHECK ("app"."privacy_request_actions"."action" in ('correct', 'restrict', 'anonymize', 'delete', 'preserve', 'purge'))
);
--> statement-breakpoint
CREATE TABLE "app"."privacy_request_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"requested_scope" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "app"."privacy_request_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" uuid NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."privacy_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"requester_contact" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"acknowledgement_due_at" timestamp with time zone NOT NULL,
	"resolution_due_at" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'received' NOT NULL,
	"outcome_reason" text,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "privacy_requests_state_ck" CHECK ("app"."privacy_requests"."state" in ('received', 'in_review', 'fulfilled', 'partially_fulfilled', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "app"."private_document_upload_intents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_module" text NOT NULL,
	"owner_record_id" uuid NOT NULL,
	"uploader_id" uuid NOT NULL,
	"temporary_object_key" text NOT NULL,
	"expected_checksum" text NOT NULL,
	"expected_mime_type" text NOT NULL,
	"expected_size_bytes" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "private_document_upload_intents_size_ck" CHECK ("app"."private_document_upload_intents"."expected_size_bytes" > 0),
	CONSTRAINT "private_document_upload_intents_state_ck" CHECK ("app"."private_document_upload_intents"."state" in ('pending', 'verified', 'expired', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "app"."private_document_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"document_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"checksum" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"uploader_id" uuid NOT NULL,
	"upload_intent_id" uuid NOT NULL,
	"supersedes_version_id" uuid,
	CONSTRAINT "private_document_versions_key_uq" UNIQUE("object_key"),
	CONSTRAINT "private_document_versions_intent_uq" UNIQUE("upload_intent_id"),
	CONSTRAINT "private_document_versions_size_ck" CHECK ("app"."private_document_versions"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."private_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_module" text NOT NULL,
	"owner_record_id" uuid NOT NULL,
	"access_classification" text NOT NULL,
	"current_version_id" uuid,
	"retention_until_at" timestamp with time zone,
	"state" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "private_documents_state_ck" CHECK ("app"."private_documents"."state" in ('active', 'restricted', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "app"."retention_candidates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"policy_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"hold_check_state" text DEFAULT 'pending' NOT NULL,
	"reference_check_state" text DEFAULT 'pending' NOT NULL,
	"review_state" text DEFAULT 'pending' NOT NULL,
	"execution_result" text,
	CONSTRAINT "retention_candidates_policy_target_uq" UNIQUE("policy_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "app"."retention_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resource_type" text NOT NULL,
	"trigger" text NOT NULL,
	"duration_days" integer NOT NULL,
	"action" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"approved_by_id" uuid NOT NULL,
	"supersedes_policy_id" uuid,
	CONSTRAINT "retention_policies_duration_ck" CHECK ("app"."retention_policies"."duration_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."security_event_contexts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"audit_event_id" uuid NOT NULL,
	"session_hash" text,
	"network_address" text,
	"client_description" text,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "security_event_contexts_audit_uq" UNIQUE("audit_event_id")
);
--> statement-breakpoint
CREATE TABLE "app"."supporting_references" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference_kind" text NOT NULL,
	"external_url" text,
	"private_document_version_id" uuid,
	"external_identifier" text,
	"text_reference" text,
	"label" text NOT NULL,
	"recorded_by_id" uuid,
	CONSTRAINT "supporting_references_kind_ck" CHECK ("app"."supporting_references"."reference_kind" in ('external_url', 'private_document', 'external_identifier', 'text')),
	CONSTRAINT "supporting_references_one_source_ck" CHECK (num_nonnulls("app"."supporting_references"."external_url", "app"."supporting_references"."private_document_version_id", "app"."supporting_references"."external_identifier", "app"."supporting_references"."text_reference") = 1),
	CONSTRAINT "supporting_references_typed_source_ck" CHECK (("app"."supporting_references"."reference_kind" = 'external_url' and "app"."supporting_references"."external_url" is not null) or ("app"."supporting_references"."reference_kind" = 'private_document' and "app"."supporting_references"."private_document_version_id" is not null) or ("app"."supporting_references"."reference_kind" = 'external_identifier' and "app"."supporting_references"."external_identifier" is not null) or ("app"."supporting_references"."reference_kind" = 'text' and "app"."supporting_references"."text_reference" is not null))
);
--> statement-breakpoint
CREATE TABLE "app"."admin_access_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"admin_identity_id" uuid NOT NULL,
	"source_invitation_id" uuid,
	"source" text NOT NULL,
	"state" text DEFAULT 'invited' NOT NULL,
	"effective_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "admin_access_grants_source_ck" CHECK ("app"."admin_access_grants"."source" in ('invitation', 'bootstrap')),
	CONSTRAINT "admin_access_grants_source_invitation_ck" CHECK (("app"."admin_access_grants"."source" = 'bootstrap' and "app"."admin_access_grants"."source_invitation_id" is null) or ("app"."admin_access_grants"."source" = 'invitation' and "app"."admin_access_grants"."source_invitation_id" is not null)),
	CONSTRAINT "admin_access_grants_state_ck" CHECK ("app"."admin_access_grants"."state" in ('invited', 'active', 'suspended', 'revoked')),
	CONSTRAINT "admin_access_grants_period_ck" CHECK ("app"."admin_access_grants"."ended_at" is null or ("app"."admin_access_grants"."effective_at" is not null and "app"."admin_access_grants"."ended_at" >= "app"."admin_access_grants"."effective_at"))
);
--> statement-breakpoint
CREATE TABLE "app"."admin_access_state_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"grant_id" uuid NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"reason" text,
	"actor_id" uuid,
	"external_sync_state" text DEFAULT 'not_required' NOT NULL,
	CONSTRAINT "admin_access_state_transitions_to_ck" CHECK ("app"."admin_access_state_transitions"."to_state" in ('invited', 'active', 'suspended', 'revoked')),
	CONSTRAINT "admin_access_state_transitions_sync_ck" CHECK ("app"."admin_access_state_transitions"."external_sync_state" in ('not_required', 'pending', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."admin_external_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"admin_identity_id" uuid NOT NULL,
	"provider" text DEFAULT 'clerk' NOT NULL,
	"provider_user_id" text NOT NULL,
	"last_synchronized_at" timestamp with time zone NOT NULL,
	"provider_updated_at" timestamp with time zone,
	CONSTRAINT "admin_external_identities_provider_user_uq" UNIQUE("provider","provider_user_id"),
	CONSTRAINT "admin_external_identities_admin_provider_uq" UNIQUE("admin_identity_id","provider")
);
--> statement-breakpoint
CREATE TABLE "app"."admin_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"lifecycle_state" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "admin_identities_state_ck" CHECK ("app"."admin_identities"."lifecycle_state" in ('active', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "app"."admin_invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"normalized_email" text NOT NULL,
	"provider_invitation_id" text,
	"inviter_admin_identity_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"resend_count" integer DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp with time zone,
	CONSTRAINT "admin_invitations_state_ck" CHECK ("app"."admin_invitations"."state" in ('pending', 'accepted', 'expired', 'revoked')),
	CONSTRAINT "admin_invitations_resend_ck" CHECK ("app"."admin_invitations"."resend_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."admin_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"grant_id" uuid NOT NULL,
	"provider_session_hash" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"provider_expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "admin_sessions_hash_uq" UNIQUE("provider_session_hash")
);
--> statement-breakpoint
CREATE TABLE "app"."external_identity_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'clerk' NOT NULL,
	"provider_event_id" text NOT NULL,
	"provider_subject_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"sanitized_fields" jsonb NOT NULL,
	"processing_state" text DEFAULT 'pending' NOT NULL,
	"outcome" text,
	CONSTRAINT "external_identity_events_source_event_uq" UNIQUE("source","provider_event_id"),
	CONSTRAINT "external_identity_events_state_ck" CHECK ("app"."external_identity_events"."processing_state" in ('pending', 'processed', 'ignored', 'reconciliation_required', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."external_sync_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"admin_identity_id" uuid NOT NULL,
	"requested_local_version" bigint NOT NULL,
	"operation_type" text NOT NULL,
	"deterministic_key" text NOT NULL,
	"provider_reference" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"sanitized_outcome" text,
	CONSTRAINT "external_sync_operations_key_uq" UNIQUE("deterministic_key"),
	CONSTRAINT "external_sync_operations_attempt_ck" CHECK ("app"."external_sync_operations"."attempt_count" >= 0),
	CONSTRAINT "external_sync_operations_state_ck" CHECK ("app"."external_sync_operations"."state" in ('pending', 'running', 'succeeded', 'failed', 'reconciliation_required'))
);
--> statement-breakpoint
CREATE TABLE "app"."privileged_operation_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"operation" text NOT NULL,
	"operator_snapshot" text NOT NULL,
	"reason" text NOT NULL,
	"evidence_reference_id" uuid,
	"outcome" text NOT NULL,
	"reconciliation_state" text DEFAULT 'not_required' NOT NULL,
	CONSTRAINT "privileged_operation_records_operation_ck" CHECK ("app"."privileged_operation_records"."operation" in ('bootstrap', 'break_glass')),
	CONSTRAINT "privileged_operation_records_outcome_ck" CHECK ("app"."privileged_operation_records"."outcome" in ('succeeded', 'denied', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."reconciliation_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_event_id" uuid,
	"affected_record_type" text NOT NULL,
	"affected_record_id" uuid,
	"explanation" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "reconciliation_items_state_ck" CHECK ("app"."reconciliation_items"."state" in ('open', 'resolved', 'dismissed'))
);
--> statement-breakpoint
CREATE TABLE "app"."disciplinary_summary_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"season_entry_id" uuid NOT NULL,
	"yellow_cards" integer NOT NULL,
	"second_yellow_dismissals" integer NOT NULL,
	"direct_red_cards" integer NOT NULL,
	"correction_reason" text,
	"actor_id" uuid NOT NULL,
	"supersedes_summary_id" uuid,
	CONSTRAINT "disciplinary_summary_versions_counts_ck" CHECK ("app"."disciplinary_summary_versions"."yellow_cards" >= 0 and "app"."disciplinary_summary_versions"."second_yellow_dismissals" >= 0 and "app"."disciplinary_summary_versions"."direct_red_cards" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."fixture_rounds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"stage_version_id" uuid NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "fixture_rounds_stage_code_uq" UNIQUE("stage_id","code"),
	CONSTRAINT "fixture_rounds_stage_position_uq" UNIQUE("stage_id","position"),
	CONSTRAINT "fixture_rounds_position_ck" CHECK ("app"."fixture_rounds"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."fixture_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"stage_version_id" uuid NOT NULL,
	"slot_type" text NOT NULL,
	"stable_code" text NOT NULL,
	CONSTRAINT "fixture_slots_stage_code_uq" UNIQUE("stage_id","stable_code"),
	CONSTRAINT "fixture_slots_type_ck" CHECK ("app"."fixture_slots"."slot_type" in ('league', 'knockout', 'playoff', 'replacement'))
);
--> statement-breakpoint
CREATE TABLE "app"."knockout_fixture_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fixture_slot_id" uuid NOT NULL,
	"tie_id" uuid NOT NULL,
	"match_role" text NOT NULL,
	CONSTRAINT "knockout_fixture_slots_slot_uq" UNIQUE("fixture_slot_id"),
	CONSTRAINT "knockout_fixture_slots_tie_role_uq" UNIQUE("tie_id","match_role"),
	CONSTRAINT "knockout_fixture_slots_role_ck" CHECK ("app"."knockout_fixture_slots"."match_role" in ('single', 'first_leg', 'second_leg', 'replay'))
);
--> statement-breakpoint
CREATE TABLE "app"."league_fixture_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fixture_slot_id" uuid NOT NULL,
	"fixture_round_id" uuid NOT NULL,
	"home_stage_participant_slot_id" uuid NOT NULL,
	"away_stage_participant_slot_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "league_fixture_slots_slot_uq" UNIQUE("fixture_slot_id"),
	CONSTRAINT "league_fixture_slots_round_position_uq" UNIQUE("fixture_round_id","position"),
	CONSTRAINT "league_fixture_slots_position_ck" CHECK ("app"."league_fixture_slots"."position" > 0),
	CONSTRAINT "league_fixture_slots_distinct_participants_ck" CHECK ("app"."league_fixture_slots"."home_stage_participant_slot_id" <> "app"."league_fixture_slots"."away_stage_participant_slot_id")
);
--> statement-breakpoint
CREATE TABLE "app"."match_actual_kickoffs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"actual_kickoff_at" timestamp with time zone NOT NULL,
	"correction_reason" text,
	"actor_id" uuid NOT NULL,
	"supersedes_kickoff_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."match_participant_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"role" text NOT NULL,
	"season_entry_id" uuid NOT NULL,
	"source_stage_participant_slot_id" uuid,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supersedes_assignment_id" uuid,
	CONSTRAINT "match_participant_assignments_role_ck" CHECK ("app"."match_participant_assignments"."role" in ('home', 'away'))
);
--> statement-breakpoint
CREATE TABLE "app"."match_participant_occupancies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"season_entry_id" uuid NOT NULL,
	"schedule_revision_id" uuid NOT NULL,
	"planned_period" "tstzrange" NOT NULL,
	CONSTRAINT "match_participant_occupancies_match_entry_uq" UNIQUE("match_id","season_entry_id"),
	CONSTRAINT "match_participant_occupancies_period_ck" CHECK (not isempty("app"."match_participant_occupancies"."planned_period") and lower_inc("app"."match_participant_occupancies"."planned_period") and not upper_inc("app"."match_participant_occupancies"."planned_period"))
);
--> statement-breakpoint
CREATE TABLE "app"."match_publication_batch_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"batch_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"schedule_revision_id" uuid NOT NULL,
	CONSTRAINT "match_publication_batch_items_match_uq" UNIQUE("batch_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "app"."match_publication_batches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scope_kind" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"actor_id" uuid NOT NULL,
	"audit_event_id" uuid,
	CONSTRAINT "match_publication_batches_scope_ck" CHECK ("app"."match_publication_batches"."scope_kind" in ('match', 'fixture_round', 'knockout_round', 'stage'))
);
--> statement-breakpoint
CREATE TABLE "app"."match_replacements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"original_match_id" uuid NOT NULL,
	"replacement_match_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supersedes_replacement_id" uuid,
	CONSTRAINT "match_replacements_replacement_uq" UNIQUE("replacement_match_id"),
	CONSTRAINT "match_replacements_distinct_ck" CHECK ("app"."match_replacements"."original_match_id" <> "app"."match_replacements"."replacement_match_id")
);
--> statement-breakpoint
CREATE TABLE "app"."match_result_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"proposed_source" text NOT NULL,
	"home_regulation_goals" integer,
	"away_regulation_goals" integer,
	"home_extra_time_goals" integer,
	"away_extra_time_goals" integer,
	"home_penalty_kicks" integer,
	"away_penalty_kicks" integer,
	"proposed_technical_home_goals" integer,
	"proposed_technical_away_goals" integer,
	"technical_ruling_id" uuid,
	"validation_state" text DEFAULT 'unvalidated' NOT NULL,
	CONSTRAINT "match_result_drafts_match_uq" UNIQUE("match_id"),
	CONSTRAINT "match_result_drafts_source_ck" CHECK ("app"."match_result_drafts"."proposed_source" in ('played', 'technical')),
	CONSTRAINT "match_result_drafts_goals_ck" CHECK (coalesce("app"."match_result_drafts"."home_regulation_goals", 0) >= 0 and coalesce("app"."match_result_drafts"."away_regulation_goals", 0) >= 0 and coalesce("app"."match_result_drafts"."home_extra_time_goals", 0) >= 0 and coalesce("app"."match_result_drafts"."away_extra_time_goals", 0) >= 0 and coalesce("app"."match_result_drafts"."home_penalty_kicks", 0) >= 0 and coalesce("app"."match_result_drafts"."away_penalty_kicks", 0) >= 0),
	CONSTRAINT "match_result_drafts_technical_goals_ck" CHECK (coalesce("app"."match_result_drafts"."proposed_technical_home_goals", 0) >= 0 and coalesce("app"."match_result_drafts"."proposed_technical_away_goals", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."match_result_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"played_score_version_id" uuid,
	"technical_result_id" uuid,
	"penalty_shootout_version_id" uuid,
	"home_assignment_id" uuid NOT NULL,
	"away_assignment_id" uuid NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	"confirmed_by_actor_id" uuid NOT NULL,
	"supersedes_result_id" uuid,
	CONSTRAINT "match_result_versions_number_uq" UNIQUE("match_id","version_number"),
	CONSTRAINT "match_result_versions_number_ck" CHECK ("app"."match_result_versions"."version_number" > 0),
	CONSTRAINT "match_result_versions_source_ck" CHECK (("app"."match_result_versions"."played_score_version_id" is not null) <> ("app"."match_result_versions"."technical_result_id" is not null)),
	CONSTRAINT "match_result_versions_shootout_ck" CHECK ("app"."match_result_versions"."penalty_shootout_version_id" is null or ("app"."match_result_versions"."played_score_version_id" is not null and "app"."match_result_versions"."technical_result_id" is null)),
	CONSTRAINT "match_result_versions_distinct_assignments_ck" CHECK ("app"."match_result_versions"."home_assignment_id" <> "app"."match_result_versions"."away_assignment_id")
);
--> statement-breakpoint
CREATE TABLE "app"."match_schedule_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"kickoff_on" date,
	"kickoff_at_local" time,
	"timezone" text NOT NULL,
	"venue_id" uuid,
	"playing_field_id" uuid,
	"venue_designation" text DEFAULT 'home' NOT NULL,
	"expected_duration_minutes" integer,
	"turnaround_minutes" integer,
	"expected_match_version" bigint NOT NULL,
	CONSTRAINT "match_schedule_drafts_match_uq" UNIQUE("match_id"),
	CONSTRAINT "match_schedule_drafts_designation_ck" CHECK ("app"."match_schedule_drafts"."venue_designation" in ('home', 'away', 'neutral')),
	CONSTRAINT "match_schedule_drafts_duration_ck" CHECK ("app"."match_schedule_drafts"."expected_duration_minutes" is null or "app"."match_schedule_drafts"."expected_duration_minutes" > 0),
	CONSTRAINT "match_schedule_drafts_turnaround_ck" CHECK ("app"."match_schedule_drafts"."turnaround_minutes" is null or "app"."match_schedule_drafts"."turnaround_minutes" >= 0),
	CONSTRAINT "match_schedule_drafts_field_venue_ck" CHECK ("app"."match_schedule_drafts"."playing_field_id" is null or "app"."match_schedule_drafts"."venue_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "app"."match_schedule_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"previous_revision_id" uuid,
	"kickoff_on" date,
	"kickoff_at_local" time,
	"timezone" text NOT NULL,
	"kickoff_at_utc" timestamp with time zone,
	"venue_id" uuid,
	"playing_field_id" uuid,
	"venue_name_snapshot" text,
	"venue_address_snapshot" text,
	"playing_field_name_snapshot" text,
	"venue_designation" text NOT NULL,
	"home_assignment_id" uuid,
	"away_assignment_id" uuid,
	"expected_duration_minutes" integer,
	"turnaround_minutes" integer,
	"internal_reason" text NOT NULL,
	"public_explanation" text,
	"actor_id" uuid NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	CONSTRAINT "match_schedule_revisions_designation_ck" CHECK ("app"."match_schedule_revisions"."venue_designation" in ('home', 'away', 'neutral')),
	CONSTRAINT "match_schedule_revisions_kickoff_ck" CHECK (("app"."match_schedule_revisions"."kickoff_at_utc" is not null) = ("app"."match_schedule_revisions"."kickoff_on" is not null and "app"."match_schedule_revisions"."kickoff_at_local" is not null)),
	CONSTRAINT "match_schedule_revisions_field_venue_ck" CHECK ("app"."match_schedule_revisions"."playing_field_id" is null or "app"."match_schedule_revisions"."venue_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "app"."match_state_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"cause_reference_id" uuid,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."match_visibility_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"from_visibility" text NOT NULL,
	"to_visibility" text NOT NULL,
	"publication_batch_id" uuid,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fixture_slot_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"sporting_state" text DEFAULT 'unscheduled' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"calendar_uid" text NOT NULL,
	"current_home_assignment_id" uuid,
	"current_away_assignment_id" uuid,
	"current_schedule_revision_id" uuid,
	"current_result_version_id" uuid,
	"current_actual_kickoff_id" uuid,
	CONSTRAINT "matches_fixture_slot_uq" UNIQUE("fixture_slot_id"),
	CONSTRAINT "matches_calendar_uid_uq" UNIQUE("calendar_uid"),
	CONSTRAINT "matches_state_ck" CHECK ("app"."matches"."sporting_state" in ('unscheduled', 'scheduled', 'postponed', 'in_progress', 'suspended', 'finished', 'cancelled')),
	CONSTRAINT "matches_visibility_ck" CHECK ("app"."matches"."visibility" in ('private', 'public')),
	CONSTRAINT "matches_finished_result_ck" CHECK (("app"."matches"."sporting_state" = 'finished') = ("app"."matches"."current_result_version_id" is not null)),
	CONSTRAINT "matches_distinct_assignments_ck" CHECK ("app"."matches"."current_home_assignment_id" is null or "app"."matches"."current_away_assignment_id" is null or "app"."matches"."current_home_assignment_id" <> "app"."matches"."current_away_assignment_id")
);
--> statement-breakpoint
CREATE TABLE "app"."penalty_shootout_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"home_successful_kicks" integer NOT NULL,
	"away_successful_kicks" integer NOT NULL,
	"winner_season_entry_id" uuid NOT NULL,
	"correction_reason" text,
	"actor_id" uuid NOT NULL,
	"supersedes_shootout_id" uuid,
	CONSTRAINT "penalty_shootout_versions_kicks_ck" CHECK ("app"."penalty_shootout_versions"."home_successful_kicks" >= 0 and "app"."penalty_shootout_versions"."away_successful_kicks" >= 0 and "app"."penalty_shootout_versions"."home_successful_kicks" <> "app"."penalty_shootout_versions"."away_successful_kicks")
);
--> statement-breakpoint
CREATE TABLE "app"."played_score_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"home_regulation_goals" integer NOT NULL,
	"away_regulation_goals" integer NOT NULL,
	"home_extra_time_goals" integer,
	"away_extra_time_goals" integer,
	"correction_reason" text,
	"actor_id" uuid NOT NULL,
	"supersedes_score_id" uuid,
	CONSTRAINT "played_score_versions_regulation_ck" CHECK ("app"."played_score_versions"."home_regulation_goals" >= 0 and "app"."played_score_versions"."away_regulation_goals" >= 0),
	CONSTRAINT "played_score_versions_extra_time_ck" CHECK (("app"."played_score_versions"."home_extra_time_goals" is null and "app"."played_score_versions"."away_extra_time_goals" is null) or ("app"."played_score_versions"."home_extra_time_goals" >= 0 and "app"."played_score_versions"."away_extra_time_goals" >= 0))
);
--> statement-breakpoint
CREATE TABLE "app"."playing_fields" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"default_duration_minutes" integer,
	"default_turnaround_minutes" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"archive_state" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "playing_fields_venue_code_uq" UNIQUE("venue_id","code"),
	CONSTRAINT "playing_fields_duration_ck" CHECK ("app"."playing_fields"."default_duration_minutes" is null or "app"."playing_fields"."default_duration_minutes" > 0),
	CONSTRAINT "playing_fields_turnaround_ck" CHECK ("app"."playing_fields"."default_turnaround_minutes" is null or "app"."playing_fields"."default_turnaround_minutes" >= 0),
	CONSTRAINT "playing_fields_archive_ck" CHECK ("app"."playing_fields"."archive_state" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "app"."playoff_fixture_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fixture_slot_id" uuid NOT NULL,
	"ranking_tie_case_id" uuid NOT NULL,
	CONSTRAINT "playoff_fixture_slots_slot_uq" UNIQUE("fixture_slot_id")
);
--> statement-breakpoint
CREATE TABLE "app"."replacement_fixture_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fixture_slot_id" uuid NOT NULL,
	"original_match_id" uuid NOT NULL,
	CONSTRAINT "replacement_fixture_slots_slot_uq" UNIQUE("fixture_slot_id")
);
--> statement-breakpoint
CREATE TABLE "app"."rest_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fixture_round_id" uuid NOT NULL,
	"stage_participant_slot_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "rest_slots_round_position_uq" UNIQUE("fixture_round_id","position"),
	CONSTRAINT "rest_slots_round_participant_uq" UNIQUE("fixture_round_id","stage_participant_slot_id"),
	CONSTRAINT "rest_slots_position_ck" CHECK ("app"."rest_slots"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."result_rulings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"decided_on" date NOT NULL,
	"actor_id" uuid NOT NULL,
	"supporting_reference_id" uuid,
	"supersedes_ruling_id" uuid,
	CONSTRAINT "result_rulings_action_ck" CHECK ("app"."result_rulings"."action" in ('assign', 'revise', 'revoke'))
);
--> statement-breakpoint
CREATE TABLE "app"."technical_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" uuid NOT NULL,
	"ruling_id" uuid NOT NULL,
	"home_goals" integer NOT NULL,
	"away_goals" integer NOT NULL,
	CONSTRAINT "technical_results_ruling_uq" UNIQUE("ruling_id"),
	CONSTRAINT "technical_results_goals_ck" CHECK ("app"."technical_results"."home_goals" >= 0 and "app"."technical_results"."away_goals" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."venue_profile_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"locality" text,
	"address" text,
	"latitude" text,
	"longitude" text,
	"correction_reason" text,
	"author_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."venues" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_profile_version_id" uuid,
	"name" text NOT NULL,
	"locality" text,
	"address" text,
	"latitude" text,
	"longitude" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"archive_state" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "venues_visibility_ck" CHECK ("app"."venues"."visibility" in ('private', 'public')),
	CONSTRAINT "venues_archive_state_ck" CHECK ("app"."venues"."archive_state" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "app"."media_asset_metadata_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"source" text NOT NULL,
	"creator" text,
	"rights_statement" text NOT NULL,
	"default_alt_text" text,
	"default_caption" text,
	"correction_reason" text,
	"author_id" uuid NOT NULL,
	"supersedes_version_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."media_asset_state_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text,
	"actor_id" uuid,
	"processing_attempt_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."media_asset_variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"presentation_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"format" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"object_key" text NOT NULL,
	"checksum" text NOT NULL,
	"processing_state" text NOT NULL,
	CONSTRAINT "media_asset_variants_purpose_uq" UNIQUE("presentation_id","purpose","format","width"),
	CONSTRAINT "media_asset_variants_key_uq" UNIQUE("object_key"),
	CONSTRAINT "media_asset_variants_dimensions_ck" CHECK ("app"."media_asset_variants"."width" > 0 and "app"."media_asset_variants"."height" > 0),
	CONSTRAINT "media_asset_variants_state_ck" CHECK ("app"."media_asset_variants"."processing_state" in ('ready', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."media_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"upload_intent_id" uuid NOT NULL,
	"original_filename" text NOT NULL,
	"original_object_key" text NOT NULL,
	"original_checksum" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"state" text DEFAULT 'processing' NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"current_metadata_version_id" uuid,
	"current_presentation_id" uuid,
	CONSTRAINT "media_assets_upload_intent_uq" UNIQUE("upload_intent_id"),
	CONSTRAINT "media_assets_original_key_uq" UNIQUE("original_object_key"),
	CONSTRAINT "media_assets_size_ck" CHECK ("app"."media_assets"."size_bytes" > 0 and "app"."media_assets"."size_bytes" <= 10485760),
	CONSTRAINT "media_assets_dimensions_ck" CHECK ("app"."media_assets"."width" > 0 and "app"."media_assets"."height" > 0),
	CONSTRAINT "media_assets_type_ck" CHECK ("app"."media_assets"."mime_type" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "media_assets_state_ck" CHECK ("app"."media_assets"."state" in ('processing', 'active', 'failed', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "app"."media_presentations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"focal_x" integer DEFAULT 50 NOT NULL,
	"focal_y" integer DEFAULT 50 NOT NULL,
	"transformation_version" text NOT NULL,
	"readiness" text NOT NULL,
	"supersedes_presentation_id" uuid,
	CONSTRAINT "media_presentations_focal_ck" CHECK ("app"."media_presentations"."focal_x" between 0 and 100 and "app"."media_presentations"."focal_y" between 0 and 100),
	CONSTRAINT "media_presentations_readiness_ck" CHECK ("app"."media_presentations"."readiness" in ('ready', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."media_processing_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"presentation_id" uuid,
	"processor_version" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"state" text NOT NULL,
	"sanitized_error" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "media_processing_attempts_number_uq" UNIQUE("media_asset_id","processor_version","attempt_number"),
	CONSTRAINT "media_processing_attempts_number_ck" CHECK ("app"."media_processing_attempts"."attempt_number" > 0),
	CONSTRAINT "media_processing_attempts_state_ck" CHECK ("app"."media_processing_attempts"."state" in ('pending', 'running', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."media_storage_tombstones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"variant_id" uuid,
	"object_key_hash" text NOT NULL,
	"checksum" text NOT NULL,
	"reason" text NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	"restore_reconciliation_state" text DEFAULT 'not_required' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."media_upload_intents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploader_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"temporary_object_key" text NOT NULL,
	"expected_mime_type" text NOT NULL,
	"expected_size_bytes" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "media_upload_intents_idempotency_uq" UNIQUE("uploader_id","idempotency_key"),
	CONSTRAINT "media_upload_intents_size_ck" CHECK ("app"."media_upload_intents"."expected_size_bytes" > 0 and "app"."media_upload_intents"."expected_size_bytes" <= 10485760),
	CONSTRAINT "media_upload_intents_state_ck" CHECK ("app"."media_upload_intents"."state" in ('pending', 'verified', 'expired', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "app"."media_withdrawal_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"supporting_reference_id" uuid,
	"actor_id" uuid NOT NULL,
	"urgent_purge_state" text DEFAULT 'not_required' NOT NULL,
	"supersedes_decision_id" uuid,
	CONSTRAINT "media_withdrawal_decisions_type_ck" CHECK ("app"."media_withdrawal_decisions"."decision" in ('withdraw', 'restore')),
	CONSTRAINT "media_withdrawal_decisions_purge_ck" CHECK ("app"."media_withdrawal_decisions"."urgent_purge_state" in ('not_required', 'pending', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."cache_invalidation_intents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"semantic_target" text NOT NULL,
	"committed_version" bigint NOT NULL,
	"urgency" text DEFAULT 'ordinary' NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "cache_invalidation_intents_target_version_uq" UNIQUE("semantic_target","committed_version"),
	CONSTRAINT "cache_invalidation_intents_urgency_ck" CHECK ("app"."cache_invalidation_intents"."urgency" in ('ordinary', 'urgent')),
	CONSTRAINT "cache_invalidation_intents_state_ck" CHECK ("app"."cache_invalidation_intents"."state" in ('pending', 'confirmed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."command_executions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"result_type" text,
	"result_id" uuid,
	"state" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "command_executions_scope_key_uq" UNIQUE("actor_scope","idempotency_key"),
	CONSTRAINT "command_executions_state_ck" CHECK ("app"."command_executions"."state" in ('pending', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."inbound_webhook_receipts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"signature_result" text NOT NULL,
	"payload_hash" text NOT NULL,
	"sanitized_payload" jsonb,
	"processing_state" text DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "inbound_webhook_receipts_source_event_uq" UNIQUE("source","provider_event_id"),
	CONSTRAINT "inbound_webhook_receipts_signature_ck" CHECK ("app"."inbound_webhook_receipts"."signature_result" in ('verified', 'rejected')),
	CONSTRAINT "inbound_webhook_receipts_state_ck" CHECK ("app"."inbound_webhook_receipts"."processing_state" in ('pending', 'processed', 'ignored', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "app"."incident_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"severity" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"owner_snapshot" text NOT NULL,
	"impact_summary" text NOT NULL,
	"affected_classification" text NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"postmortem_reference" text,
	CONSTRAINT "incident_records_severity_ck" CHECK ("app"."incident_records"."severity" in ('sev1', 'sev2', 'sev3')),
	CONSTRAINT "incident_records_state_ck" CHECK ("app"."incident_records"."state" in ('open', 'mitigating', 'resolved', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "app"."incident_state_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"incident_id" uuid NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"actor_snapshot" text NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."job_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"outcome" text NOT NULL,
	"sanitized_error" text,
	CONSTRAINT "job_runs_attempt_uq" UNIQUE("job_id","attempt_number"),
	CONSTRAINT "job_runs_attempt_ck" CHECK ("app"."job_runs"."attempt_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."notification_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"template" text NOT NULL,
	"template_version" integer NOT NULL,
	"recipient_class" text NOT NULL,
	"recipient_address" text,
	"deterministic_key" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"provider_reference" text,
	"sanitized_outcome" text,
	CONSTRAINT "notification_deliveries_key_uq" UNIQUE("deterministic_key"),
	CONSTRAINT "notification_deliveries_template_version_ck" CHECK ("app"."notification_deliveries"."template_version" > 0),
	CONSTRAINT "notification_deliveries_state_ck" CHECK ("app"."notification_deliveries"."state" in ('pending', 'sent', 'failed', 'suppressed'))
);
--> statement-breakpoint
CREATE TABLE "app"."operational_alerts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"severity" text NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"incident_id" uuid,
	CONSTRAINT "operational_alerts_state_ck" CHECK ("app"."operational_alerts"."state" in ('open', 'acknowledged', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "app"."outbox_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_type" text NOT NULL,
	"schema_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"aggregate_version" bigint NOT NULL,
	"correlation_key" text,
	"causation_key" text,
	"available_at" timestamp with time zone NOT NULL,
	"lease_until_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"sanitized_outcome" text,
	CONSTRAINT "outbox_messages_schema_ck" CHECK ("app"."outbox_messages"."schema_version" > 0),
	CONSTRAINT "outbox_messages_attempts_ck" CHECK ("app"."outbox_messages"."attempt_count" >= 0),
	CONSTRAINT "outbox_messages_state_ck" CHECK ("app"."outbox_messages"."state" in ('pending', 'leased', 'succeeded', 'failed', 'exhausted'))
);
--> statement-breakpoint
CREATE TABLE "app"."recovery_verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"backup_reference" text NOT NULL,
	"recovery_point_at" timestamp with time zone NOT NULL,
	"elapsed_seconds" integer NOT NULL,
	"integrity_checks" jsonb NOT NULL,
	"operator_snapshot" text NOT NULL,
	"outcome" text NOT NULL,
	CONSTRAINT "recovery_verifications_elapsed_ck" CHECK ("app"."recovery_verifications"."elapsed_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."restore_validations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recovery_verification_id" uuid NOT NULL,
	"admin_identity_id" uuid NOT NULL,
	"results_valid" text NOT NULL,
	"standings_valid" text NOT NULL,
	"applications_valid" text NOT NULL,
	"publications_valid" text NOT NULL,
	"cache_valid" text NOT NULL,
	"reason" text,
	"outcome" text NOT NULL,
	CONSTRAINT "restore_validations_recovery_admin_uq" UNIQUE("recovery_verification_id","admin_identity_id")
);
--> statement-breakpoint
CREATE TABLE "app"."scheduled_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logical_job_key" text NOT NULL,
	"job_type" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"target_version" bigint,
	"due_at" timestamp with time zone NOT NULL,
	"lease_until_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "scheduled_jobs_logical_key_uq" UNIQUE("logical_job_key"),
	CONSTRAINT "scheduled_jobs_attempts_ck" CHECK ("app"."scheduled_jobs"."attempt_count" >= 0),
	CONSTRAINT "scheduled_jobs_state_ck" CHECK ("app"."scheduled_jobs"."state" in ('pending', 'leased', 'succeeded', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "app"."application_checklist_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"application_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"required" boolean NOT NULL,
	"review_outcome" text NOT NULL,
	"reviewer_id" uuid,
	"exception_reference_id" uuid,
	CONSTRAINT "application_checklist_items_position_uq" UNIQUE("application_id","position")
);
--> statement-breakpoint
CREATE TABLE "app"."application_checklist_template_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"template_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"required" boolean NOT NULL,
	CONSTRAINT "application_checklist_template_items_position_uq" UNIQUE("template_id","position")
);
--> statement-breakpoint
CREATE TABLE "app"."application_checklist_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"name" text NOT NULL,
	"item_definition_hash" text NOT NULL,
	"author_id" uuid NOT NULL,
	CONSTRAINT "application_checklist_templates_version_uq" UNIQUE("season_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "app"."legionnaire_classification_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"roster_entry_id" uuid NOT NULL,
	"classification" text NOT NULL,
	"basis" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supersedes_decision_id" uuid,
	CONSTRAINT "legionnaire_classification_decisions_type_ck" CHECK ("app"."legionnaire_classification_decisions"."classification" in ('local', 'legionnaire'))
);
--> statement-breakpoint
CREATE TABLE "app"."legionnaire_quota_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"roster_rule_set_id" uuid NOT NULL,
	"base_limit" integer NOT NULL,
	"additional_limit" integer,
	"additional_birth_date_cutoff" date,
	CONSTRAINT "legionnaire_quota_versions_rule_uq" UNIQUE("roster_rule_set_id"),
	CONSTRAINT "legionnaire_quota_versions_base_ck" CHECK ("app"."legionnaire_quota_versions"."base_limit" >= 0),
	CONSTRAINT "legionnaire_quota_versions_additional_ck" CHECK (("app"."legionnaire_quota_versions"."additional_limit" is null and "app"."legionnaire_quota_versions"."additional_birth_date_cutoff" is null) or ("app"."legionnaire_quota_versions"."additional_limit" > 0 and "app"."legionnaire_quota_versions"."additional_birth_date_cutoff" is not null))
);
--> statement-breakpoint
CREATE TABLE "app"."player_identity_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"player_id" uuid NOT NULL,
	"given_name" text NOT NULL,
	"family_name" text NOT NULL,
	"patronymic" text,
	"display_name" text NOT NULL,
	"normalized_search_name" text NOT NULL,
	"correction_reason" text,
	"author_id" uuid NOT NULL,
	CONSTRAINT "player_identity_versions_owner_id_uq" UNIQUE("player_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."player_merges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retained_player_id" uuid NOT NULL,
	"retired_player_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	CONSTRAINT "player_merges_retired_uq" UNIQUE("retired_player_id"),
	CONSTRAINT "player_merges_distinct_players_ck" CHECK ("app"."player_merges"."retained_player_id" <> "app"."player_merges"."retired_player_id")
);
--> statement-breakpoint
CREATE TABLE "app"."player_private_detail_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"private_details_id" uuid NOT NULL,
	"date_of_birth" date NOT NULL,
	"federation_identifier" text,
	"correction_reason" text,
	"author_id" uuid NOT NULL,
	"supersedes_version_id" uuid,
	CONSTRAINT "player_private_detail_versions_owner_id_uq" UNIQUE("private_details_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."player_private_details" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"player_id" uuid NOT NULL,
	"current_version_id" uuid,
	CONSTRAINT "player_private_details_player_uq" UNIQUE("player_id")
);
--> statement-breakpoint
CREATE TABLE "app"."player_publication_consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"player_id" uuid NOT NULL,
	"lawful_basis" text NOT NULL,
	"representative_name" text,
	"scope" text NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"supporting_reference_id" uuid,
	"recorded_by_actor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."player_publication_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"player_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	CONSTRAINT "player_publication_transitions_state_ck" CHECK ("app"."player_publication_transitions"."to_state" in ('restricted', 'minimal', 'full'))
);
--> statement-breakpoint
CREATE TABLE "app"."players" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_identity_version_id" uuid,
	"public_profile_state" text DEFAULT 'restricted' NOT NULL,
	"current_photo_media_asset_id" uuid,
	"merged_into_player_id" uuid,
	CONSTRAINT "players_public_profile_state_ck" CHECK ("app"."players"."public_profile_state" in ('restricted', 'minimal', 'full')),
	CONSTRAINT "players_no_self_merge_ck" CHECK ("app"."players"."merged_into_player_id" is null or "app"."players"."merged_into_player_id" <> "app"."players"."id")
);
--> statement-breakpoint
CREATE TABLE "app"."registration_window_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"window_id" uuid NOT NULL,
	"action" text NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."registration_windows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	"window_type" text NOT NULL,
	"starts_on" date NOT NULL,
	"starts_at_local" time,
	"ends_on" date NOT NULL,
	"ends_at_local" time,
	"timezone" text NOT NULL,
	"state" text DEFAULT 'scheduled' NOT NULL,
	CONSTRAINT "registration_windows_type_ck" CHECK ("app"."registration_windows"."window_type" in ('team_entry', 'roster_registration', 'roster_transfer')),
	CONSTRAINT "registration_windows_date_order_ck" CHECK ("app"."registration_windows"."ends_on" >= "app"."registration_windows"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "app"."roster_eligibility_rulings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"roster_entry_id" uuid NOT NULL,
	"waived_rule_code" text NOT NULL,
	"effective_period" daterange NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supporting_reference_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."roster_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"roster_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"playing_position" text,
	"current_classification_decision_id" uuid,
	"current_decision_id" uuid,
	CONSTRAINT "roster_entries_state_ck" CHECK ("app"."roster_entries"."state" in ('pending', 'active', 'rejected', 'ended'))
);
--> statement-breakpoint
CREATE TABLE "app"."roster_entry_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"roster_entry_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supporting_reference_id" uuid,
	CONSTRAINT "roster_entry_decisions_action_ck" CHECK ("app"."roster_entry_decisions"."action" in ('submit', 'activate', 'reject', 'end'))
);
--> statement-breakpoint
CREATE TABLE "app"."roster_readiness_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"roster_id" uuid NOT NULL,
	"roster_version" bigint NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"ready" boolean NOT NULL,
	"blocking_reason_codes" text[] NOT NULL,
	"actor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."roster_registration_period_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"period_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"effective_period" daterange NOT NULL,
	"approval_state" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supersedes_revision_id" uuid,
	CONSTRAINT "roster_registration_period_revisions_number_uq" UNIQUE("period_id","revision_number"),
	CONSTRAINT "roster_registration_period_revisions_state_ck" CHECK ("app"."roster_registration_period_revisions"."approval_state" in ('approved', 'voided')),
	CONSTRAINT "roster_registration_period_revisions_action_ck" CHECK ("app"."roster_registration_period_revisions"."action" in ('opened', 'closed', 'corrected', 'voided'))
);
--> statement-breakpoint
CREATE TABLE "app"."roster_registration_periods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"player_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"roster_entry_id" uuid NOT NULL,
	"effective_period" daterange NOT NULL,
	"approval_state" text DEFAULT 'approved' NOT NULL,
	"decision_id" uuid,
	"current_revision_id" uuid,
	CONSTRAINT "roster_registration_periods_state_ck" CHECK ("app"."roster_registration_periods"."approval_state" in ('approved', 'voided')),
	CONSTRAINT "roster_registration_periods_bounds_ck" CHECK (not isempty("app"."roster_registration_periods"."effective_period") and lower_inc("app"."roster_registration_periods"."effective_period") and not upper_inc("app"."roster_registration_periods"."effective_period"))
);
--> statement-breakpoint
CREATE TABLE "app"."roster_rule_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"minimum_size" integer NOT NULL,
	"maximum_size" integer NOT NULL,
	"readiness_required" boolean NOT NULL,
	"effective_from_at" timestamp with time zone NOT NULL,
	"author_id" uuid NOT NULL,
	CONSTRAINT "roster_rule_sets_season_version_uq" UNIQUE("season_id","version_number"),
	CONSTRAINT "roster_rule_sets_size_ck" CHECK ("app"."roster_rule_sets"."minimum_size" >= 0 and "app"."roster_rule_sets"."maximum_size" >= "app"."roster_rule_sets"."minimum_size")
);
--> statement-breakpoint
CREATE TABLE "app"."roster_transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_roster_entry_id" uuid NOT NULL,
	"destination_roster_entry_id" uuid,
	"player_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"transfer_window_id" uuid NOT NULL,
	"effective_on" date NOT NULL,
	"state" text DEFAULT 'proposed' NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "roster_transfers_distinct_entries_ck" CHECK ("app"."roster_transfers"."destination_roster_entry_id" is null or "app"."roster_transfers"."source_roster_entry_id" <> "app"."roster_transfers"."destination_roster_entry_id")
);
--> statement-breakpoint
CREATE TABLE "app"."season_application_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"application_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supporting_reference_id" uuid,
	CONSTRAINT "season_application_decisions_action_ck" CHECK ("app"."season_application_decisions"."action" in ('record', 'review', 'approve', 'reject', 'withdraw', 'supersede'))
);
--> statement-breakpoint
CREATE TABLE "app"."season_applications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"submitted_on" date,
	"state" text DEFAULT 'recorded' NOT NULL,
	"current_decision_id" uuid,
	"checklist_template_id" uuid,
	CONSTRAINT "season_applications_state_ck" CHECK ("app"."season_applications"."state" in ('recorded', 'under_review', 'approved', 'rejected', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "app"."season_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"approved_application_id" uuid NOT NULL,
	"participation_state" text DEFAULT 'registered' NOT NULL,
	CONSTRAINT "season_entries_team_season_uq" UNIQUE("season_id","team_id"),
	CONSTRAINT "season_entries_application_uq" UNIQUE("approved_application_id"),
	CONSTRAINT "season_entries_season_id_uq" UNIQUE("season_id","id"),
	CONSTRAINT "season_entries_state_ck" CHECK ("app"."season_entries"."participation_state" in ('registered', 'suspended', 'withdrawn', 'disqualified'))
);
--> statement-breakpoint
CREATE TABLE "app"."season_entry_state_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_entry_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."season_rosters" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"season_entry_id" uuid NOT NULL,
	"current_rule_set_id" uuid,
	"current_readiness_decision_id" uuid,
	CONSTRAINT "season_rosters_entry_uq" UNIQUE("season_entry_id")
);
--> statement-breakpoint
CREATE TABLE "app"."team_profile_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"team_id" uuid NOT NULL,
	"official_name" text NOT NULL,
	"short_name" text,
	"locality" text,
	"logo_media_asset_id" uuid,
	"correction_reason" text,
	"author_id" uuid NOT NULL,
	CONSTRAINT "team_profile_versions_owner_id_uq" UNIQUE("team_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."team_slugs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"team_id" uuid NOT NULL,
	"display_slug" text NOT NULL,
	"normalized_slug" text NOT NULL,
	"valid_from_at" timestamp with time zone NOT NULL,
	CONSTRAINT "team_slugs_owner_id_uq" UNIQUE("team_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."teams" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_name" text NOT NULL,
	"locality" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"archive_state" text DEFAULT 'active' NOT NULL,
	"current_profile_version_id" uuid,
	"current_slug_id" uuid,
	CONSTRAINT "teams_visibility_ck" CHECK ("app"."teams"."visibility" in ('private', 'public')),
	CONSTRAINT "teams_archive_state_ck" CHECK ("app"."teams"."archive_state" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "app"."confirmed_byes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_slot_id" uuid NOT NULL,
	"destination_slot_id" uuid NOT NULL,
	"season_entry_id" uuid NOT NULL,
	"draw_outcome_id" uuid,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supersedes_bye_id" uuid,
	CONSTRAINT "confirmed_byes_distinct_slots_ck" CHECK ("app"."confirmed_byes"."source_slot_id" <> "app"."confirmed_byes"."destination_slot_id")
);
--> statement-breakpoint
CREATE TABLE "app"."cross_group_comparison_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ranking_rule_set_id" uuid NOT NULL,
	"method" text NOT NULL,
	"excluded_lowest_count" integer,
	"validation_hash" text NOT NULL,
	CONSTRAINT "cross_group_comparison_rules_rule_uq" UNIQUE("ranking_rule_set_id"),
	CONSTRAINT "cross_group_comparison_rules_method_ck" CHECK ("app"."cross_group_comparison_rules"."method" in ('all_matches', 'exclude_lowest', 'per_match_ratio')),
	CONSTRAINT "cross_group_comparison_rules_exclusion_ck" CHECK (("app"."cross_group_comparison_rules"."method" = 'exclude_lowest' and "app"."cross_group_comparison_rules"."excluded_lowest_count" > 0) or ("app"."cross_group_comparison_rules"."method" <> 'exclude_lowest' and "app"."cross_group_comparison_rules"."excluded_lowest_count" is null))
);
--> statement-breakpoint
CREATE TABLE "app"."cross_group_tie_breakers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"comparison_rule_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"criterion" text NOT NULL,
	"direction" text DEFAULT 'desc' NOT NULL,
	CONSTRAINT "cross_group_tie_breakers_order_uq" UNIQUE("comparison_rule_id","position"),
	CONSTRAINT "cross_group_tie_breakers_position_ck" CHECK ("app"."cross_group_tie_breakers"."position" > 0),
	CONSTRAINT "cross_group_tie_breakers_direction_ck" CHECK ("app"."cross_group_tie_breakers"."direction" in ('asc', 'desc'))
);
--> statement-breakpoint
CREATE TABLE "app"."draw_constraints" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"draw_pool_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_pot_id" uuid,
	"target_pot_id" uuid,
	"parameter" text
);
--> statement-breakpoint
CREATE TABLE "app"."draw_outcome_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"draw_outcome_id" uuid NOT NULL,
	"draw_pool_entry_id" uuid,
	"unresolved_source_slot_id" uuid,
	"tie_participant_slot_id" uuid NOT NULL,
	CONSTRAINT "draw_outcome_assignments_dest_uq" UNIQUE("draw_outcome_id","tie_participant_slot_id"),
	CONSTRAINT "draw_outcome_assignments_source_ck" CHECK (("app"."draw_outcome_assignments"."draw_pool_entry_id" is not null) <> ("app"."draw_outcome_assignments"."unresolved_source_slot_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "app"."draw_outcome_draft_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"draft_id" uuid NOT NULL,
	"draw_pool_entry_id" uuid,
	"unresolved_source_slot_id" uuid,
	"tie_participant_slot_id" uuid NOT NULL,
	CONSTRAINT "draw_outcome_draft_assignments_dest_uq" UNIQUE("draft_id","tie_participant_slot_id"),
	CONSTRAINT "draw_outcome_draft_assignments_source_ck" CHECK (("app"."draw_outcome_draft_assignments"."draw_pool_entry_id" is not null) <> ("app"."draw_outcome_draft_assignments"."unresolved_source_slot_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "app"."draw_outcome_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"round_id" uuid NOT NULL,
	"round_version_id" uuid NOT NULL,
	"external_draw_on" date,
	"supporting_reference_id" uuid,
	"validation_state" text DEFAULT 'unvalidated' NOT NULL,
	"validation_hash" text,
	"author_id" uuid NOT NULL,
	CONSTRAINT "draw_outcome_drafts_round_uq" UNIQUE("round_id")
);
--> statement-breakpoint
CREATE TABLE "app"."draw_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"round_id" uuid NOT NULL,
	"round_version_id" uuid NOT NULL,
	"external_draw_on" date NOT NULL,
	"actor_id" uuid NOT NULL,
	"supporting_reference_id" uuid,
	"content_hash" text NOT NULL,
	"supersedes_outcome_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."draw_pool_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"draw_pool_id" uuid NOT NULL,
	"season_entry_id" uuid,
	"source_qualification_output_id" uuid,
	"unresolved_source_slot_id" uuid,
	"pot_id" uuid,
	"position" integer NOT NULL,
	CONSTRAINT "draw_pool_entries_pool_position_uq" UNIQUE("draw_pool_id","position"),
	CONSTRAINT "draw_pool_entries_position_ck" CHECK ("app"."draw_pool_entries"."position" > 0),
	CONSTRAINT "draw_pool_entries_source_ck" CHECK (num_nonnulls("app"."draw_pool_entries"."season_entry_id", "app"."draw_pool_entries"."source_qualification_output_id", "app"."draw_pool_entries"."unresolved_source_slot_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "app"."draw_pools" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"round_version_id" uuid NOT NULL,
	"code" text NOT NULL,
	"mode" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "draw_pools_round_code_uq" UNIQUE("round_version_id","code"),
	CONSTRAINT "draw_pools_round_position_uq" UNIQUE("round_version_id","position"),
	CONSTRAINT "draw_pools_mode_ck" CHECK ("app"."draw_pools"."mode" in ('open', 'seeded')),
	CONSTRAINT "draw_pools_position_ck" CHECK ("app"."draw_pools"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."draw_pots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"draw_pool_id" uuid NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "draw_pots_pool_code_uq" UNIQUE("draw_pool_id","code"),
	CONSTRAINT "draw_pots_pool_position_uq" UNIQUE("draw_pool_id","position"),
	CONSTRAINT "draw_pots_position_ck" CHECK ("app"."draw_pots"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."fair_play_weight_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ranking_rule_set_id" uuid NOT NULL,
	"yellow_card_weight" integer NOT NULL,
	"second_yellow_weight" integer NOT NULL,
	"direct_red_weight" integer NOT NULL,
	CONSTRAINT "fair_play_weight_sets_rule_uq" UNIQUE("ranking_rule_set_id"),
	CONSTRAINT "fair_play_weight_sets_nonnegative_ck" CHECK ("app"."fair_play_weight_sets"."yellow_card_weight" >= 0 and "app"."fair_play_weight_sets"."second_yellow_weight" >= 0 and "app"."fair_play_weight_sets"."direct_red_weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."final_knockout_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"tie_version_id" uuid,
	"tie_outcome_id" uuid,
	"draw_outcome_id" uuid,
	"confirmed_bye_id" uuid,
	"tie_ruling_id" uuid,
	"placement_output_id" uuid,
	"qualification_output_id" uuid,
	CONSTRAINT "final_knockout_evidence_one_source_ck" CHECK (num_nonnulls("app"."final_knockout_evidence"."tie_version_id", "app"."final_knockout_evidence"."tie_outcome_id", "app"."final_knockout_evidence"."draw_outcome_id", "app"."final_knockout_evidence"."confirmed_bye_id", "app"."final_knockout_evidence"."tie_ruling_id", "app"."final_knockout_evidence"."placement_output_id", "app"."final_knockout_evidence"."qualification_output_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "app"."final_knockout_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"stage_version_id" uuid NOT NULL,
	"finalization_number" integer NOT NULL,
	"input_hash" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"finalized_at" timestamp with time zone NOT NULL,
	"supersedes_snapshot_id" uuid,
	CONSTRAINT "final_knockout_snapshots_number_uq" UNIQUE("stage_id","finalization_number"),
	CONSTRAINT "final_knockout_snapshots_number_ck" CHECK ("app"."final_knockout_snapshots"."finalization_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."final_standings_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"match_result_version_id" uuid,
	"disciplinary_summary_version_id" uuid,
	"standing_adjustment_decision_id" uuid,
	"playoff_match_result_version_id" uuid,
	"ranking_ruling_id" uuid,
	CONSTRAINT "final_standings_evidence_one_source_ck" CHECK (num_nonnulls("app"."final_standings_evidence"."match_result_version_id", "app"."final_standings_evidence"."disciplinary_summary_version_id", "app"."final_standings_evidence"."standing_adjustment_decision_id", "app"."final_standings_evidence"."playoff_match_result_version_id", "app"."final_standings_evidence"."ranking_ruling_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "app"."final_standings_rows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"group_id" uuid,
	"season_entry_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"played" integer NOT NULL,
	"wins" integer NOT NULL,
	"draws" integer NOT NULL,
	"losses" integer NOT NULL,
	"goals_for" integer NOT NULL,
	"goals_against" integer NOT NULL,
	"points" integer NOT NULL,
	CONSTRAINT "final_standings_rows_entry_uq" UNIQUE("snapshot_id","season_entry_id"),
	CONSTRAINT "final_standings_rows_position_ck" CHECK ("app"."final_standings_rows"."position" > 0),
	CONSTRAINT "final_standings_rows_totals_ck" CHECK ("app"."final_standings_rows"."played" >= 0 and "app"."final_standings_rows"."wins" >= 0 and "app"."final_standings_rows"."draws" >= 0 and "app"."final_standings_rows"."losses" >= 0 and "app"."final_standings_rows"."goals_for" >= 0 and "app"."final_standings_rows"."goals_against" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."final_standings_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"stage_version_id" uuid NOT NULL,
	"ranking_rule_set_id" uuid NOT NULL,
	"finalization_number" integer NOT NULL,
	"input_hash" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"finalized_at" timestamp with time zone NOT NULL,
	"supersedes_snapshot_id" uuid,
	CONSTRAINT "final_standings_snapshots_number_uq" UNIQUE("stage_id","finalization_number"),
	CONSTRAINT "final_standings_snapshots_number_ck" CHECK ("app"."final_standings_snapshots"."finalization_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."knockout_round_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"round_id" uuid NOT NULL,
	"stage_version_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"position" integer NOT NULL,
	"bracket_mode" text NOT NULL,
	"tie_resolution_rule_set_id" uuid NOT NULL,
	CONSTRAINT "knockout_round_versions_number_uq" UNIQUE("round_id","version_number"),
	CONSTRAINT "knockout_round_versions_stage_position_uq" UNIQUE("stage_version_id","position"),
	CONSTRAINT "knockout_round_versions_number_position_ck" CHECK ("app"."knockout_round_versions"."version_number" > 0 and "app"."knockout_round_versions"."position" > 0),
	CONSTRAINT "knockout_round_versions_mode_ck" CHECK ("app"."knockout_round_versions"."bracket_mode" in ('fixed_bracket', 'redraw_each_round'))
);
--> statement-breakpoint
CREATE TABLE "app"."knockout_rounds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"stable_code" text NOT NULL,
	"current_version_id" uuid,
	CONSTRAINT "knockout_rounds_stage_code_uq" UNIQUE("stage_id","stable_code")
);
--> statement-breakpoint
CREATE TABLE "app"."knockout_tie_participant_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tie_id" uuid NOT NULL,
	"side" text NOT NULL,
	"expected_source_kind" text NOT NULL,
	"source_qualification_slot_id" uuid,
	"source_stage_participant_slot_id" uuid,
	"current_season_entry_id" uuid,
	"current_draw_assignment_id" uuid,
	CONSTRAINT "knockout_tie_participant_slots_side_uq" UNIQUE("tie_id","side"),
	CONSTRAINT "knockout_tie_participant_slots_side_ck" CHECK ("app"."knockout_tie_participant_slots"."side" in ('home', 'away')),
	CONSTRAINT "knockout_tie_participant_slots_source_ck" CHECK ("app"."knockout_tie_participant_slots"."expected_source_kind" in ('direct_entry', 'qualification', 'stage_output', 'draw'))
);
--> statement-breakpoint
CREATE TABLE "app"."knockout_tie_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tie_id" uuid NOT NULL,
	"round_version_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"bracket_position" integer NOT NULL,
	"placement_kind" text,
	"home_slot_id" uuid NOT NULL,
	"away_slot_id" uuid NOT NULL,
	"winner_destination_slot_id" uuid,
	"loser_destination_slot_id" uuid,
	CONSTRAINT "knockout_tie_versions_number_uq" UNIQUE("tie_id","version_number"),
	CONSTRAINT "knockout_tie_versions_bracket_position_uq" UNIQUE("round_version_id","bracket_position"),
	CONSTRAINT "knockout_tie_versions_position_ck" CHECK ("app"."knockout_tie_versions"."version_number" > 0 and "app"."knockout_tie_versions"."bracket_position" > 0),
	CONSTRAINT "knockout_tie_versions_slots_ck" CHECK ("app"."knockout_tie_versions"."home_slot_id" <> "app"."knockout_tie_versions"."away_slot_id"),
	CONSTRAINT "knockout_tie_versions_placement_ck" CHECK ("app"."knockout_tie_versions"."placement_kind" is null or "app"."knockout_tie_versions"."placement_kind" in ('final', 'third_place'))
);
--> statement-breakpoint
CREATE TABLE "app"."knockout_ties" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"round_id" uuid NOT NULL,
	"stable_code" text NOT NULL,
	"sporting_state" text DEFAULT 'configured' NOT NULL,
	"current_version_id" uuid,
	"current_ruling_id" uuid,
	"current_outcome_id" uuid,
	CONSTRAINT "knockout_ties_round_code_uq" UNIQUE("round_id","stable_code"),
	CONSTRAINT "knockout_ties_state_ck" CHECK ("app"."knockout_ties"."sporting_state" in ('configured', 'ready', 'in_progress', 'awaiting_finalization', 'finalized', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE "app"."placement_outputs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"tie_outcome_id" uuid NOT NULL,
	"placement_kind" text NOT NULL,
	"season_entry_id" uuid NOT NULL,
	CONSTRAINT "placement_outputs_tie_kind_uq" UNIQUE("tie_outcome_id","placement_kind"),
	CONSTRAINT "placement_outputs_kind_ck" CHECK ("app"."placement_outputs"."placement_kind" in ('champion', 'runner_up', 'third', 'fourth'))
);
--> statement-breakpoint
CREATE TABLE "app"."points_schemes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ranking_rule_set_id" uuid NOT NULL,
	"win_points" integer DEFAULT 3 NOT NULL,
	"draw_points" integer DEFAULT 1 NOT NULL,
	"loss_points" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "points_schemes_rule_set_uq" UNIQUE("ranking_rule_set_id")
);
--> statement-breakpoint
CREATE TABLE "app"."qualification_outputs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_final_standings_snapshot_id" uuid,
	"source_final_knockout_snapshot_id" uuid,
	"destination_slot_id" uuid NOT NULL,
	"outcome_kind" text NOT NULL,
	"season_entry_id" uuid,
	"qualification_ruling_id" uuid,
	"supersedes_output_id" uuid,
	CONSTRAINT "qualification_outputs_source_ck" CHECK (("app"."qualification_outputs"."source_final_standings_snapshot_id" is not null) <> ("app"."qualification_outputs"."source_final_knockout_snapshot_id" is not null)),
	CONSTRAINT "qualification_outputs_kind_ck" CHECK ("app"."qualification_outputs"."outcome_kind" in ('entry', 'vacant', 'bye')),
	CONSTRAINT "qualification_outputs_entry_ck" CHECK (("app"."qualification_outputs"."outcome_kind" = 'entry' and "app"."qualification_outputs"."season_entry_id" is not null) or ("app"."qualification_outputs"."outcome_kind" <> 'entry' and "app"."qualification_outputs"."season_entry_id" is null))
);
--> statement-breakpoint
CREATE TABLE "app"."qualification_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ranking_rule_set_id" uuid NOT NULL,
	"source_group_id" uuid,
	"comparison_rule_id" uuid,
	"rank_from" integer NOT NULL,
	"rank_through" integer NOT NULL,
	"destination_slot_id" uuid,
	"destination_draw_pool_id" uuid,
	CONSTRAINT "qualification_rules_rank_ck" CHECK ("app"."qualification_rules"."rank_from" > 0 and "app"."qualification_rules"."rank_through" >= "app"."qualification_rules"."rank_from"),
	CONSTRAINT "qualification_rules_destination_ck" CHECK (("app"."qualification_rules"."destination_slot_id" is not null) <> ("app"."qualification_rules"."destination_draw_pool_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "app"."qualification_rulings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_snapshot_id" uuid NOT NULL,
	"calculated_season_entry_id" uuid NOT NULL,
	"outcome_kind" text NOT NULL,
	"replacement_season_entry_id" uuid,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supporting_reference_id" uuid,
	"supersedes_ruling_id" uuid,
	CONSTRAINT "qualification_rulings_kind_ck" CHECK ("app"."qualification_rulings"."outcome_kind" in ('replacement', 'vacant', 'bye')),
	CONSTRAINT "qualification_rulings_replacement_ck" CHECK (("app"."qualification_rulings"."outcome_kind" = 'replacement' and "app"."qualification_rulings"."replacement_season_entry_id" is not null) or ("app"."qualification_rulings"."outcome_kind" <> 'replacement' and "app"."qualification_rulings"."replacement_season_entry_id" is null))
);
--> statement-breakpoint
CREATE TABLE "app"."qualification_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"knockout_round_id" uuid,
	"knockout_tie_id" uuid,
	"stable_code" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "qualification_slots_stage_code_uq" UNIQUE("stage_id","stable_code"),
	CONSTRAINT "qualification_slots_position_ck" CHECK ("app"."qualification_slots"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."ranking_rule_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_version_id" uuid NOT NULL,
	"validation_hash" text NOT NULL,
	CONSTRAINT "ranking_rule_sets_stage_version_uq" UNIQUE("stage_version_id")
);
--> statement-breakpoint
CREATE TABLE "app"."ranking_ruling_positions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ruling_id" uuid NOT NULL,
	"season_entry_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "ranking_ruling_positions_entry_uq" UNIQUE("ruling_id","season_entry_id"),
	CONSTRAINT "ranking_ruling_positions_position_uq" UNIQUE("ruling_id","position"),
	CONSTRAINT "ranking_ruling_positions_positive_ck" CHECK ("app"."ranking_ruling_positions"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."ranking_rulings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tie_case_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supporting_reference_id" uuid,
	"supersedes_ruling_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."ranking_tie_case_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tie_case_id" uuid NOT NULL,
	"season_entry_id" uuid NOT NULL,
	"calculated_position" integer NOT NULL,
	CONSTRAINT "ranking_tie_case_entries_entry_uq" UNIQUE("tie_case_id","season_entry_id"),
	CONSTRAINT "ranking_tie_case_entries_position_ck" CHECK ("app"."ranking_tie_case_entries"."calculated_position" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."ranking_tie_cases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"group_id" uuid,
	"ranking_rule_set_id" uuid NOT NULL,
	"rank_from" integer NOT NULL,
	"rank_through" integer NOT NULL,
	"crosses_qualification_boundary" boolean NOT NULL,
	"input_hash" text NOT NULL,
	"calculation_hash" text NOT NULL,
	"trace_schema_version" integer NOT NULL,
	"calculation_trace" jsonb NOT NULL,
	CONSTRAINT "ranking_tie_cases_rank_ck" CHECK ("app"."ranking_tie_cases"."rank_from" > 0 and "app"."ranking_tie_cases"."rank_through" >= "app"."ranking_tie_cases"."rank_from"),
	CONSTRAINT "ranking_tie_cases_trace_version_ck" CHECK ("app"."ranking_tie_cases"."trace_schema_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."stage_participant_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slot_id" uuid NOT NULL,
	"season_entry_id" uuid NOT NULL,
	"source_qualification_output_id" uuid,
	"source_draw_outcome_assignment_id" uuid,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supersedes_assignment_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."stage_participant_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"stage_version_id" uuid NOT NULL,
	"stable_code" text NOT NULL,
	"position" integer NOT NULL,
	"expected_source_kind" text NOT NULL,
	"expected_source_slot_id" uuid,
	"current_assignment_id" uuid,
	CONSTRAINT "stage_participant_slots_stage_code_uq" UNIQUE("stage_id","stable_code"),
	CONSTRAINT "stage_participant_slots_stage_position_uq" UNIQUE("stage_id","position"),
	CONSTRAINT "stage_participant_slots_position_ck" CHECK ("app"."stage_participant_slots"."position" > 0),
	CONSTRAINT "stage_participant_slots_source_ck" CHECK ("app"."stage_participant_slots"."expected_source_kind" in ('direct_entry', 'qualification', 'draw', 'bye'))
);
--> statement-breakpoint
CREATE TABLE "app"."standing_adjustment_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"season_entry_id" uuid NOT NULL,
	"action" text NOT NULL,
	"points_delta" integer,
	"effective_on" date NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"supporting_reference_id" uuid,
	"supersedes_decision_id" uuid,
	CONSTRAINT "standing_adjustment_decisions_action_ck" CHECK ("app"."standing_adjustment_decisions"."action" in ('apply', 'revoke', 'replace')),
	CONSTRAINT "standing_adjustment_decisions_delta_ck" CHECK (("app"."standing_adjustment_decisions"."action" = 'revoke' and "app"."standing_adjustment_decisions"."points_delta" is null) or ("app"."standing_adjustment_decisions"."action" <> 'revoke' and "app"."standing_adjustment_decisions"."points_delta" is not null and "app"."standing_adjustment_decisions"."points_delta" <> 0))
);
--> statement-breakpoint
CREATE TABLE "app"."tie_breakers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ranking_rule_set_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"criterion" text NOT NULL,
	"direction" text DEFAULT 'desc' NOT NULL,
	CONSTRAINT "tie_breakers_rule_position_uq" UNIQUE("ranking_rule_set_id","position"),
	CONSTRAINT "tie_breakers_position_ck" CHECK ("app"."tie_breakers"."position" > 0),
	CONSTRAINT "tie_breakers_direction_ck" CHECK ("app"."tie_breakers"."direction" in ('asc', 'desc')),
	CONSTRAINT "tie_breakers_criterion_ck" CHECK ("app"."tie_breakers"."criterion" in ('goal_difference', 'goals_scored', 'away_goals', 'wins', 'head_to_head_points', 'head_to_head_goal_difference', 'head_to_head_goals_scored', 'head_to_head_away_goals', 'fair_play', 'playoff_match', 'ranking_ruling'))
);
--> statement-breakpoint
CREATE TABLE "app"."tie_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tie_id" uuid NOT NULL,
	"tie_version_id" uuid NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"first_match_result_version_id" uuid,
	"second_leg_result_version_id" uuid,
	"replay_result_version_id" uuid,
	"decisive_shootout_version_id" uuid,
	"tie_ruling_id" uuid,
	"aggregate_home_goals" integer,
	"aggregate_away_goals" integer,
	"winner_season_entry_id" uuid NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	"actor_id" uuid NOT NULL,
	"supersedes_outcome_id" uuid,
	CONSTRAINT "tie_outcomes_aggregate_ck" CHECK (("app"."tie_outcomes"."aggregate_home_goals" is null and "app"."tie_outcomes"."aggregate_away_goals" is null) or ("app"."tie_outcomes"."aggregate_home_goals" >= 0 and "app"."tie_outcomes"."aggregate_away_goals" >= 0)),
	CONSTRAINT "tie_outcomes_evidence_ck" CHECK (num_nonnulls("app"."tie_outcomes"."first_match_result_version_id", "app"."tie_outcomes"."second_leg_result_version_id", "app"."tie_outcomes"."replay_result_version_id", "app"."tie_outcomes"."tie_ruling_id") > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."tie_resolution_rule_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"round_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"leg_count" integer NOT NULL,
	"validation_hash" text NOT NULL,
	CONSTRAINT "tie_resolution_rule_sets_round_number_uq" UNIQUE("round_id","version_number"),
	CONSTRAINT "tie_resolution_rule_sets_number_ck" CHECK ("app"."tie_resolution_rule_sets"."version_number" > 0),
	CONSTRAINT "tie_resolution_rule_sets_legs_ck" CHECK ("app"."tie_resolution_rule_sets"."leg_count" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "app"."tie_resolution_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"step_type" text NOT NULL,
	CONSTRAINT "tie_resolution_steps_rule_position_uq" UNIQUE("rule_set_id","position"),
	CONSTRAINT "tie_resolution_steps_position_ck" CHECK ("app"."tie_resolution_steps"."position" > 0),
	CONSTRAINT "tie_resolution_steps_type_ck" CHECK ("app"."tie_resolution_steps"."step_type" in ('regulation', 'aggregate', 'extra_time', 'replay', 'penalties'))
);
--> statement-breakpoint
CREATE TABLE "app"."tie_rulings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tie_id" uuid NOT NULL,
	"action" text NOT NULL,
	"winner_season_entry_id" uuid,
	"reason" text NOT NULL,
	"decided_on" date NOT NULL,
	"actor_id" uuid NOT NULL,
	"supporting_reference_id" uuid,
	"supersedes_ruling_id" uuid,
	CONSTRAINT "tie_rulings_action_ck" CHECK ("app"."tie_rulings"."action" in ('assign', 'revise', 'revoke')),
	CONSTRAINT "tie_rulings_winner_ck" CHECK (("app"."tie_rulings"."action" = 'revoke' and "app"."tie_rulings"."winner_season_entry_id" is null) or ("app"."tie_rulings"."action" <> 'revoke' and "app"."tie_rulings"."winner_season_entry_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "app"."tie_state_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tie_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"ruling_id" uuid
);
--> statement-breakpoint
ALTER TABLE "app"."competition_format_activations" ADD CONSTRAINT "competition_format_activations_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_format_activations" ADD CONSTRAINT "competition_format_activations_format_version_id_competition_format_versions_id_fk" FOREIGN KEY ("format_version_id") REFERENCES "app"."competition_format_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_format_activations" ADD CONSTRAINT "competition_format_activations_replaced_activation_id_competition_format_activations_id_fk" FOREIGN KEY ("replaced_activation_id") REFERENCES "app"."competition_format_activations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_format_activations" ADD CONSTRAINT "competition_format_activations_owner_fk" FOREIGN KEY ("season_id","format_version_id") REFERENCES "app"."competition_format_versions"("season_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_format_drafts" ADD CONSTRAINT "competition_format_drafts_format_id_competition_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "app"."competition_formats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_format_drafts" ADD CONSTRAINT "competition_format_drafts_base_version_id_competition_format_versions_id_fk" FOREIGN KEY ("base_version_id") REFERENCES "app"."competition_format_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_format_versions" ADD CONSTRAINT "competition_format_versions_format_id_competition_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "app"."competition_formats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_format_versions" ADD CONSTRAINT "competition_format_versions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_format_versions" ADD CONSTRAINT "competition_format_versions_source_draft_id_competition_format_drafts_id_fk" FOREIGN KEY ("source_draft_id") REFERENCES "app"."competition_format_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_formats" ADD CONSTRAINT "competition_formats_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_profile_versions" ADD CONSTRAINT "competition_profile_versions_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "app"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_slugs" ADD CONSTRAINT "competition_slugs_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "app"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_stage_versions" ADD CONSTRAINT "competition_stage_versions_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_stage_versions" ADD CONSTRAINT "competition_stage_versions_format_version_id_competition_format_versions_id_fk" FOREIGN KEY ("format_version_id") REFERENCES "app"."competition_format_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_stages" ADD CONSTRAINT "competition_stages_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competition_stages" ADD CONSTRAINT "competition_stages_current_version_id_competition_stage_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "app"."competition_stage_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competitions" ADD CONSTRAINT "competitions_current_slug_id_competition_slugs_id_fk" FOREIGN KEY ("current_slug_id") REFERENCES "app"."competition_slugs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competitions" ADD CONSTRAINT "competitions_current_profile_version_id_competition_profile_versions_id_fk" FOREIGN KEY ("current_profile_version_id") REFERENCES "app"."competition_profile_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."competitions" ADD CONSTRAINT "competitions_current_season_id_seasons_id_fk" FOREIGN KEY ("current_season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."current_season_designations" ADD CONSTRAINT "current_season_designations_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "app"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."current_season_designations" ADD CONSTRAINT "current_season_designations_previous_season_id_seasons_id_fk" FOREIGN KEY ("previous_season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."current_season_designations" ADD CONSTRAINT "current_season_designations_selected_season_id_seasons_id_fk" FOREIGN KEY ("selected_season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."current_season_designations" ADD CONSTRAINT "current_season_designations_owner_fk" FOREIGN KEY ("competition_id","selected_season_id") REFERENCES "app"."seasons"("competition_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_amendment_stages" ADD CONSTRAINT "format_amendment_stages_amendment_id_format_amendments_id_fk" FOREIGN KEY ("amendment_id") REFERENCES "app"."format_amendments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_amendment_stages" ADD CONSTRAINT "format_amendment_stages_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_amendment_transitions" ADD CONSTRAINT "format_amendment_transitions_amendment_id_format_amendments_id_fk" FOREIGN KEY ("amendment_id") REFERENCES "app"."format_amendments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_amendment_transitions" ADD CONSTRAINT "format_amendment_transitions_activated_version_id_competition_format_versions_id_fk" FOREIGN KEY ("activated_version_id") REFERENCES "app"."competition_format_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_amendments" ADD CONSTRAINT "format_amendments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_amendments" ADD CONSTRAINT "format_amendments_base_version_id_competition_format_versions_id_fk" FOREIGN KEY ("base_version_id") REFERENCES "app"."competition_format_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_amendments" ADD CONSTRAINT "format_amendments_target_draft_id_competition_format_drafts_id_fk" FOREIGN KEY ("target_draft_id") REFERENCES "app"."competition_format_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_amendments" ADD CONSTRAINT "format_amendments_applied_version_id_competition_format_versions_id_fk" FOREIGN KEY ("applied_version_id") REFERENCES "app"."competition_format_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_dependencies" ADD CONSTRAINT "format_draft_dependencies_draft_id_competition_format_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "app"."competition_format_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_dependencies" ADD CONSTRAINT "format_draft_dependencies_source_stage_id_format_draft_stages_id_fk" FOREIGN KEY ("source_stage_id") REFERENCES "app"."format_draft_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_dependencies" ADD CONSTRAINT "format_draft_dependencies_destination_slot_id_format_draft_participant_slots_id_fk" FOREIGN KEY ("destination_slot_id") REFERENCES "app"."format_draft_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_draw_constraints" ADD CONSTRAINT "format_draft_draw_constraints_draw_pool_id_format_draft_draw_pools_id_fk" FOREIGN KEY ("draw_pool_id") REFERENCES "app"."format_draft_draw_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_draw_constraints" ADD CONSTRAINT "format_draft_draw_constraints_source_pot_id_format_draft_draw_pots_id_fk" FOREIGN KEY ("source_pot_id") REFERENCES "app"."format_draft_draw_pots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_draw_constraints" ADD CONSTRAINT "format_draft_draw_constraints_target_pot_id_format_draft_draw_pots_id_fk" FOREIGN KEY ("target_pot_id") REFERENCES "app"."format_draft_draw_pots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_draw_pools" ADD CONSTRAINT "format_draft_draw_pools_draft_id_competition_format_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "app"."competition_format_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_draw_pools" ADD CONSTRAINT "format_draft_draw_pools_stage_id_format_draft_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."format_draft_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_draw_pots" ADD CONSTRAINT "format_draft_draw_pots_draw_pool_id_format_draft_draw_pools_id_fk" FOREIGN KEY ("draw_pool_id") REFERENCES "app"."format_draft_draw_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_knockout_rounds" ADD CONSTRAINT "format_draft_knockout_rounds_stage_id_format_draft_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."format_draft_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_knockout_ties" ADD CONSTRAINT "format_draft_knockout_ties_round_id_format_draft_knockout_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "app"."format_draft_knockout_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_knockout_ties" ADD CONSTRAINT "format_draft_knockout_ties_winner_destination_slot_id_format_draft_participant_slots_id_fk" FOREIGN KEY ("winner_destination_slot_id") REFERENCES "app"."format_draft_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_participant_slots" ADD CONSTRAINT "format_draft_participant_slots_stage_id_format_draft_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."format_draft_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_participant_slots" ADD CONSTRAINT "format_draft_participant_slots_group_id_format_draft_stage_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."format_draft_stage_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_participant_slots" ADD CONSTRAINT "format_draft_participant_slots_source_stage_id_format_draft_stages_id_fk" FOREIGN KEY ("source_stage_id") REFERENCES "app"."format_draft_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_points_schemes" ADD CONSTRAINT "format_draft_points_schemes_ranking_rule_set_id_format_draft_ranking_rule_sets_id_fk" FOREIGN KEY ("ranking_rule_set_id") REFERENCES "app"."format_draft_ranking_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_qualification_rules" ADD CONSTRAINT "format_draft_qualification_rules_source_stage_id_format_draft_stages_id_fk" FOREIGN KEY ("source_stage_id") REFERENCES "app"."format_draft_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_qualification_rules" ADD CONSTRAINT "format_draft_qualification_rules_source_group_id_format_draft_stage_groups_id_fk" FOREIGN KEY ("source_group_id") REFERENCES "app"."format_draft_stage_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_qualification_rules" ADD CONSTRAINT "format_draft_qualification_rules_destination_slot_id_format_draft_participant_slots_id_fk" FOREIGN KEY ("destination_slot_id") REFERENCES "app"."format_draft_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_qualification_rules" ADD CONSTRAINT "format_draft_qualification_rules_destination_draw_pool_id_format_draft_draw_pools_id_fk" FOREIGN KEY ("destination_draw_pool_id") REFERENCES "app"."format_draft_draw_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_ranking_rule_sets" ADD CONSTRAINT "format_draft_ranking_rule_sets_stage_id_format_draft_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."format_draft_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_resolution_steps" ADD CONSTRAINT "format_draft_resolution_steps_round_id_format_draft_knockout_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "app"."format_draft_knockout_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_stage_groups" ADD CONSTRAINT "format_draft_stage_groups_stage_id_format_draft_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."format_draft_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_stages" ADD CONSTRAINT "format_draft_stages_draft_id_competition_format_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "app"."competition_format_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_tie_breakers" ADD CONSTRAINT "format_draft_tie_breakers_ranking_rule_set_id_format_draft_ranking_rule_sets_id_fk" FOREIGN KEY ("ranking_rule_set_id") REFERENCES "app"."format_draft_ranking_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_tie_participant_slots" ADD CONSTRAINT "format_draft_tie_participant_slots_tie_id_format_draft_knockout_ties_id_fk" FOREIGN KEY ("tie_id") REFERENCES "app"."format_draft_knockout_ties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_tie_participant_slots" ADD CONSTRAINT "format_draft_tie_participant_slots_source_slot_id_format_draft_participant_slots_id_fk" FOREIGN KEY ("source_slot_id") REFERENCES "app"."format_draft_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_draft_tie_participant_slots" ADD CONSTRAINT "format_draft_tie_participant_slots_source_draw_pool_id_format_draft_draw_pools_id_fk" FOREIGN KEY ("source_draw_pool_id") REFERENCES "app"."format_draft_draw_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_template_versions" ADD CONSTRAINT "format_template_versions_template_id_format_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "app"."format_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."format_templates" ADD CONSTRAINT "format_templates_current_version_id_format_template_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "app"."format_template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_archive_transitions" ADD CONSTRAINT "season_archive_transitions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_slugs" ADD CONSTRAINT "season_slugs_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "app"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_slugs" ADD CONSTRAINT "season_slugs_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_slugs" ADD CONSTRAINT "season_slugs_season_owner_fk" FOREIGN KEY ("competition_id","season_id") REFERENCES "app"."seasons"("competition_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_state_transitions" ADD CONSTRAINT "season_state_transitions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_state_transitions" ADD CONSTRAINT "season_state_transitions_related_amendment_id_format_amendments_id_fk" FOREIGN KEY ("related_amendment_id") REFERENCES "app"."format_amendments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_visibility_transitions" ADD CONSTRAINT "season_visibility_transitions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."seasons" ADD CONSTRAINT "seasons_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "app"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."seasons" ADD CONSTRAINT "seasons_current_slug_id_season_slugs_id_fk" FOREIGN KEY ("current_slug_id") REFERENCES "app"."season_slugs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."seasons" ADD CONSTRAINT "seasons_current_format_version_id_competition_format_versions_id_fk" FOREIGN KEY ("current_format_version_id") REFERENCES "app"."competition_format_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_dependencies" ADD CONSTRAINT "stage_dependencies_format_version_id_competition_format_versions_id_fk" FOREIGN KEY ("format_version_id") REFERENCES "app"."competition_format_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_dependencies" ADD CONSTRAINT "stage_dependencies_source_stage_id_competition_stages_id_fk" FOREIGN KEY ("source_stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_dependencies" ADD CONSTRAINT "stage_dependencies_destination_stage_id_competition_stages_id_fk" FOREIGN KEY ("destination_stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_group_versions" ADD CONSTRAINT "stage_group_versions_stage_version_id_competition_stage_versions_id_fk" FOREIGN KEY ("stage_version_id") REFERENCES "app"."competition_stage_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_group_versions" ADD CONSTRAINT "stage_group_versions_group_id_stage_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."stage_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_groups" ADD CONSTRAINT "stage_groups_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_state_transitions" ADD CONSTRAINT "stage_state_transitions_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_state_transitions" ADD CONSTRAINT "stage_state_transitions_amendment_id_format_amendments_id_fk" FOREIGN KEY ("amendment_id") REFERENCES "app"."format_amendments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_categories" ADD CONSTRAINT "article_categories_current_version_id_article_category_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "app"."article_category_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_category_state_transitions" ADD CONSTRAINT "article_category_state_transitions_category_id_article_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."article_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_category_versions" ADD CONSTRAINT "article_category_versions_category_id_article_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."article_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_category_versions" ADD CONSTRAINT "article_category_versions_supersedes_version_id_article_category_versions_id_fk" FOREIGN KEY ("supersedes_version_id") REFERENCES "app"."article_category_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_competition_associations_revision" ADD CONSTRAINT "article_competition_associations_revision_revision_id_article_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "app"."article_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_competition_associations_revision" ADD CONSTRAINT "article_competition_associations_revision_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "app"."competitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_competition_associations_working" ADD CONSTRAINT "article_competition_associations_working_working_copy_id_article_working_copies_id_fk" FOREIGN KEY ("working_copy_id") REFERENCES "app"."article_working_copies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_competition_associations_working" ADD CONSTRAINT "article_competition_associations_working_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "app"."competitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_match_associations_revision" ADD CONSTRAINT "article_match_associations_revision_revision_id_article_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "app"."article_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_match_associations_revision" ADD CONSTRAINT "article_match_associations_revision_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_match_associations_working" ADD CONSTRAINT "article_match_associations_working_working_copy_id_article_working_copies_id_fk" FOREIGN KEY ("working_copy_id") REFERENCES "app"."article_working_copies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_match_associations_working" ADD CONSTRAINT "article_match_associations_working_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_media_placements_revision" ADD CONSTRAINT "article_media_placements_revision_revision_id_article_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "app"."article_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_media_placements_revision" ADD CONSTRAINT "article_media_placements_revision_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "app"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_media_placements_revision" ADD CONSTRAINT "article_media_placements_revision_presentation_id_media_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "app"."media_presentations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_media_placements_working" ADD CONSTRAINT "article_media_placements_working_working_copy_id_article_working_copies_id_fk" FOREIGN KEY ("working_copy_id") REFERENCES "app"."article_working_copies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_media_placements_working" ADD CONSTRAINT "article_media_placements_working_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "app"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_media_placements_working" ADD CONSTRAINT "article_media_placements_working_presentation_id_media_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "app"."media_presentations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_player_associations_revision" ADD CONSTRAINT "article_player_associations_revision_revision_id_article_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "app"."article_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_player_associations_revision" ADD CONSTRAINT "article_player_associations_revision_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "app"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_player_associations_working" ADD CONSTRAINT "article_player_associations_working_working_copy_id_article_working_copies_id_fk" FOREIGN KEY ("working_copy_id") REFERENCES "app"."article_working_copies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_player_associations_working" ADD CONSTRAINT "article_player_associations_working_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "app"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_publication_schedules" ADD CONSTRAINT "article_publication_schedules_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "app"."news_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_publication_schedules" ADD CONSTRAINT "article_publication_schedules_working_copy_id_article_working_copies_id_fk" FOREIGN KEY ("working_copy_id") REFERENCES "app"."article_working_copies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_recovery_snapshots" ADD CONSTRAINT "article_recovery_snapshots_working_copy_id_article_working_copies_id_fk" FOREIGN KEY ("working_copy_id") REFERENCES "app"."article_working_copies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_revisions" ADD CONSTRAINT "article_revisions_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "app"."news_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_revisions" ADD CONSTRAINT "article_revisions_slug_id_article_slugs_id_fk" FOREIGN KEY ("slug_id") REFERENCES "app"."article_slugs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_revisions" ADD CONSTRAINT "article_revisions_category_id_article_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."article_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_revisions" ADD CONSTRAINT "article_revisions_supersedes_revision_id_article_revisions_id_fk" FOREIGN KEY ("supersedes_revision_id") REFERENCES "app"."article_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_season_associations_revision" ADD CONSTRAINT "article_season_associations_revision_revision_id_article_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "app"."article_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_season_associations_revision" ADD CONSTRAINT "article_season_associations_revision_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_season_associations_working" ADD CONSTRAINT "article_season_associations_working_working_copy_id_article_working_copies_id_fk" FOREIGN KEY ("working_copy_id") REFERENCES "app"."article_working_copies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_season_associations_working" ADD CONSTRAINT "article_season_associations_working_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_slugs" ADD CONSTRAINT "article_slugs_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "app"."news_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_state_transitions" ADD CONSTRAINT "article_state_transitions_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "app"."news_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_state_transitions" ADD CONSTRAINT "article_state_transitions_publication_schedule_id_article_publication_schedules_id_fk" FOREIGN KEY ("publication_schedule_id") REFERENCES "app"."article_publication_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_state_transitions" ADD CONSTRAINT "article_state_transitions_published_revision_id_article_revisions_id_fk" FOREIGN KEY ("published_revision_id") REFERENCES "app"."article_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_team_associations_revision" ADD CONSTRAINT "article_team_associations_revision_revision_id_article_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "app"."article_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_team_associations_revision" ADD CONSTRAINT "article_team_associations_revision_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_team_associations_working" ADD CONSTRAINT "article_team_associations_working_working_copy_id_article_working_copies_id_fk" FOREIGN KEY ("working_copy_id") REFERENCES "app"."article_working_copies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_team_associations_working" ADD CONSTRAINT "article_team_associations_working_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_working_copies" ADD CONSTRAINT "article_working_copies_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "app"."news_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."article_working_copies" ADD CONSTRAINT "article_working_copies_category_id_article_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."article_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."featured_article_decisions" ADD CONSTRAINT "featured_article_decisions_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "app"."news_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."featured_article_decisions" ADD CONSTRAINT "featured_article_decisions_supersedes_decision_id_featured_article_decisions_id_fk" FOREIGN KEY ("supersedes_decision_id") REFERENCES "app"."featured_article_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."news_articles" ADD CONSTRAINT "news_articles_current_working_copy_id_article_working_copies_id_fk" FOREIGN KEY ("current_working_copy_id") REFERENCES "app"."article_working_copies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."news_articles" ADD CONSTRAINT "news_articles_current_published_revision_id_article_revisions_id_fk" FOREIGN KEY ("current_published_revision_id") REFERENCES "app"."article_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."news_articles" ADD CONSTRAINT "news_articles_current_slug_id_article_slugs_id_fk" FOREIGN KEY ("current_slug_id") REFERENCES "app"."article_slugs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_event_changes" ADD CONSTRAINT "audit_event_changes_audit_event_id_audit_events_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "app"."audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_event_targets" ADD CONSTRAINT "audit_event_targets_audit_event_id_audit_events_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "app"."audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_events" ADD CONSTRAINT "audit_events_actor_admin_identity_id_admin_identities_id_fk" FOREIGN KEY ("actor_admin_identity_id") REFERENCES "app"."admin_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."legal_hold_targets" ADD CONSTRAINT "legal_hold_targets_hold_id_legal_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "app"."legal_holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."legal_holds" ADD CONSTRAINT "legal_holds_created_by_id_admin_identities_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."legal_holds" ADD CONSTRAINT "legal_holds_released_by_id_admin_identities_id_fk" FOREIGN KEY ("released_by_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."privacy_deletion_ledger" ADD CONSTRAINT "privacy_deletion_ledger_request_id_privacy_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."privacy_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."privacy_deletion_ledger" ADD CONSTRAINT "privacy_deletion_ledger_reapplies_ledger_id_privacy_deletion_ledger_id_fk" FOREIGN KEY ("reapplies_ledger_id") REFERENCES "app"."privacy_deletion_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."privacy_request_actions" ADD CONSTRAINT "privacy_request_actions_request_item_id_privacy_request_items_id_fk" FOREIGN KEY ("request_item_id") REFERENCES "app"."privacy_request_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."privacy_request_actions" ADD CONSTRAINT "privacy_request_actions_evidence_reference_id_supporting_references_id_fk" FOREIGN KEY ("evidence_reference_id") REFERENCES "app"."supporting_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."privacy_request_actions" ADD CONSTRAINT "privacy_request_actions_actor_id_admin_identities_id_fk" FOREIGN KEY ("actor_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."privacy_request_items" ADD CONSTRAINT "privacy_request_items_request_id_privacy_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."privacy_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."privacy_request_transitions" ADD CONSTRAINT "privacy_request_transitions_request_id_privacy_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "app"."privacy_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."privacy_request_transitions" ADD CONSTRAINT "privacy_request_transitions_actor_id_admin_identities_id_fk" FOREIGN KEY ("actor_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."private_document_upload_intents" ADD CONSTRAINT "private_document_upload_intents_uploader_id_admin_identities_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."private_document_versions" ADD CONSTRAINT "private_document_versions_document_id_private_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "app"."private_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."private_document_versions" ADD CONSTRAINT "private_document_versions_uploader_id_admin_identities_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."private_document_versions" ADD CONSTRAINT "private_document_versions_upload_intent_id_private_document_upload_intents_id_fk" FOREIGN KEY ("upload_intent_id") REFERENCES "app"."private_document_upload_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."private_document_versions" ADD CONSTRAINT "private_document_versions_supersedes_version_id_private_document_versions_id_fk" FOREIGN KEY ("supersedes_version_id") REFERENCES "app"."private_document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."private_documents" ADD CONSTRAINT "private_documents_current_version_id_private_document_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "app"."private_document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."retention_candidates" ADD CONSTRAINT "retention_candidates_policy_id_retention_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "app"."retention_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."retention_policies" ADD CONSTRAINT "retention_policies_approved_by_id_admin_identities_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."retention_policies" ADD CONSTRAINT "retention_policies_supersedes_policy_id_retention_policies_id_fk" FOREIGN KEY ("supersedes_policy_id") REFERENCES "app"."retention_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."security_event_contexts" ADD CONSTRAINT "security_event_contexts_audit_event_id_audit_events_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "app"."audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."supporting_references" ADD CONSTRAINT "supporting_references_private_document_version_id_private_document_versions_id_fk" FOREIGN KEY ("private_document_version_id") REFERENCES "app"."private_document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."supporting_references" ADD CONSTRAINT "supporting_references_recorded_by_id_admin_identities_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."admin_access_grants" ADD CONSTRAINT "admin_access_grants_admin_identity_id_admin_identities_id_fk" FOREIGN KEY ("admin_identity_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."admin_access_grants" ADD CONSTRAINT "admin_access_grants_source_invitation_id_admin_invitations_id_fk" FOREIGN KEY ("source_invitation_id") REFERENCES "app"."admin_invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."admin_access_state_transitions" ADD CONSTRAINT "admin_access_state_transitions_grant_id_admin_access_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "app"."admin_access_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."admin_external_identities" ADD CONSTRAINT "admin_external_identities_admin_identity_id_admin_identities_id_fk" FOREIGN KEY ("admin_identity_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."admin_invitations" ADD CONSTRAINT "admin_invitations_inviter_admin_identity_id_admin_identities_id_fk" FOREIGN KEY ("inviter_admin_identity_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."admin_sessions" ADD CONSTRAINT "admin_sessions_grant_id_admin_access_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "app"."admin_access_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."external_sync_operations" ADD CONSTRAINT "external_sync_operations_admin_identity_id_admin_identities_id_fk" FOREIGN KEY ("admin_identity_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reconciliation_items" ADD CONSTRAINT "reconciliation_items_source_event_id_external_identity_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "app"."external_identity_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reconciliation_items" ADD CONSTRAINT "reconciliation_items_resolved_by_id_admin_identities_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."disciplinary_summary_versions" ADD CONSTRAINT "disciplinary_summary_versions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."disciplinary_summary_versions" ADD CONSTRAINT "disciplinary_summary_versions_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."disciplinary_summary_versions" ADD CONSTRAINT "disciplinary_summary_versions_supersedes_summary_id_disciplinary_summary_versions_id_fk" FOREIGN KEY ("supersedes_summary_id") REFERENCES "app"."disciplinary_summary_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fixture_rounds" ADD CONSTRAINT "fixture_rounds_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fixture_rounds" ADD CONSTRAINT "fixture_rounds_stage_version_id_competition_stage_versions_id_fk" FOREIGN KEY ("stage_version_id") REFERENCES "app"."competition_stage_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fixture_slots" ADD CONSTRAINT "fixture_slots_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fixture_slots" ADD CONSTRAINT "fixture_slots_stage_version_id_competition_stage_versions_id_fk" FOREIGN KEY ("stage_version_id") REFERENCES "app"."competition_stage_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_fixture_slots" ADD CONSTRAINT "knockout_fixture_slots_fixture_slot_id_fixture_slots_id_fk" FOREIGN KEY ("fixture_slot_id") REFERENCES "app"."fixture_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."league_fixture_slots" ADD CONSTRAINT "league_fixture_slots_fixture_slot_id_fixture_slots_id_fk" FOREIGN KEY ("fixture_slot_id") REFERENCES "app"."fixture_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."league_fixture_slots" ADD CONSTRAINT "league_fixture_slots_fixture_round_id_fixture_rounds_id_fk" FOREIGN KEY ("fixture_round_id") REFERENCES "app"."fixture_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_actual_kickoffs" ADD CONSTRAINT "match_actual_kickoffs_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_actual_kickoffs" ADD CONSTRAINT "match_actual_kickoffs_supersedes_kickoff_id_match_actual_kickoffs_id_fk" FOREIGN KEY ("supersedes_kickoff_id") REFERENCES "app"."match_actual_kickoffs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_participant_assignments" ADD CONSTRAINT "match_participant_assignments_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_participant_assignments" ADD CONSTRAINT "match_participant_assignments_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_participant_assignments" ADD CONSTRAINT "match_participant_assignments_supersedes_assignment_id_match_participant_assignments_id_fk" FOREIGN KEY ("supersedes_assignment_id") REFERENCES "app"."match_participant_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_participant_occupancies" ADD CONSTRAINT "match_participant_occupancies_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_participant_occupancies" ADD CONSTRAINT "match_participant_occupancies_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_participant_occupancies" ADD CONSTRAINT "match_participant_occupancies_schedule_revision_id_match_schedule_revisions_id_fk" FOREIGN KEY ("schedule_revision_id") REFERENCES "app"."match_schedule_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_publication_batch_items" ADD CONSTRAINT "match_publication_batch_items_batch_id_match_publication_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "app"."match_publication_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_publication_batch_items" ADD CONSTRAINT "match_publication_batch_items_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_publication_batch_items" ADD CONSTRAINT "match_publication_batch_items_schedule_revision_id_match_schedule_revisions_id_fk" FOREIGN KEY ("schedule_revision_id") REFERENCES "app"."match_schedule_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_replacements" ADD CONSTRAINT "match_replacements_original_match_id_matches_id_fk" FOREIGN KEY ("original_match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_replacements" ADD CONSTRAINT "match_replacements_replacement_match_id_matches_id_fk" FOREIGN KEY ("replacement_match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_replacements" ADD CONSTRAINT "match_replacements_supersedes_replacement_id_match_replacements_id_fk" FOREIGN KEY ("supersedes_replacement_id") REFERENCES "app"."match_replacements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_result_drafts" ADD CONSTRAINT "match_result_drafts_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_result_drafts" ADD CONSTRAINT "match_result_drafts_technical_ruling_id_result_rulings_id_fk" FOREIGN KEY ("technical_ruling_id") REFERENCES "app"."result_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_result_versions" ADD CONSTRAINT "match_result_versions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_result_versions" ADD CONSTRAINT "match_result_versions_played_score_version_id_played_score_versions_id_fk" FOREIGN KEY ("played_score_version_id") REFERENCES "app"."played_score_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_result_versions" ADD CONSTRAINT "match_result_versions_technical_result_id_technical_results_id_fk" FOREIGN KEY ("technical_result_id") REFERENCES "app"."technical_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_result_versions" ADD CONSTRAINT "match_result_versions_penalty_shootout_version_id_penalty_shootout_versions_id_fk" FOREIGN KEY ("penalty_shootout_version_id") REFERENCES "app"."penalty_shootout_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_result_versions" ADD CONSTRAINT "match_result_versions_home_assignment_id_match_participant_assignments_id_fk" FOREIGN KEY ("home_assignment_id") REFERENCES "app"."match_participant_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_result_versions" ADD CONSTRAINT "match_result_versions_away_assignment_id_match_participant_assignments_id_fk" FOREIGN KEY ("away_assignment_id") REFERENCES "app"."match_participant_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_result_versions" ADD CONSTRAINT "match_result_versions_supersedes_result_id_match_result_versions_id_fk" FOREIGN KEY ("supersedes_result_id") REFERENCES "app"."match_result_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_schedule_drafts" ADD CONSTRAINT "match_schedule_drafts_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_schedule_drafts" ADD CONSTRAINT "match_schedule_drafts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "app"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_schedule_drafts" ADD CONSTRAINT "match_schedule_drafts_playing_field_id_playing_fields_id_fk" FOREIGN KEY ("playing_field_id") REFERENCES "app"."playing_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_schedule_revisions" ADD CONSTRAINT "match_schedule_revisions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_schedule_revisions" ADD CONSTRAINT "match_schedule_revisions_previous_revision_id_match_schedule_revisions_id_fk" FOREIGN KEY ("previous_revision_id") REFERENCES "app"."match_schedule_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_schedule_revisions" ADD CONSTRAINT "match_schedule_revisions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "app"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_schedule_revisions" ADD CONSTRAINT "match_schedule_revisions_playing_field_id_playing_fields_id_fk" FOREIGN KEY ("playing_field_id") REFERENCES "app"."playing_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_schedule_revisions" ADD CONSTRAINT "match_schedule_revisions_home_assignment_id_match_participant_assignments_id_fk" FOREIGN KEY ("home_assignment_id") REFERENCES "app"."match_participant_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_schedule_revisions" ADD CONSTRAINT "match_schedule_revisions_away_assignment_id_match_participant_assignments_id_fk" FOREIGN KEY ("away_assignment_id") REFERENCES "app"."match_participant_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_state_transitions" ADD CONSTRAINT "match_state_transitions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_visibility_transitions" ADD CONSTRAINT "match_visibility_transitions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_visibility_transitions" ADD CONSTRAINT "match_visibility_transitions_publication_batch_id_match_publication_batches_id_fk" FOREIGN KEY ("publication_batch_id") REFERENCES "app"."match_publication_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_fixture_slot_id_fixture_slots_id_fk" FOREIGN KEY ("fixture_slot_id") REFERENCES "app"."fixture_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_current_home_assignment_id_match_participant_assignments_id_fk" FOREIGN KEY ("current_home_assignment_id") REFERENCES "app"."match_participant_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_current_away_assignment_id_match_participant_assignments_id_fk" FOREIGN KEY ("current_away_assignment_id") REFERENCES "app"."match_participant_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_current_schedule_revision_id_match_schedule_revisions_id_fk" FOREIGN KEY ("current_schedule_revision_id") REFERENCES "app"."match_schedule_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_current_result_version_id_match_result_versions_id_fk" FOREIGN KEY ("current_result_version_id") REFERENCES "app"."match_result_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."matches" ADD CONSTRAINT "matches_current_actual_kickoff_id_match_actual_kickoffs_id_fk" FOREIGN KEY ("current_actual_kickoff_id") REFERENCES "app"."match_actual_kickoffs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."penalty_shootout_versions" ADD CONSTRAINT "penalty_shootout_versions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."penalty_shootout_versions" ADD CONSTRAINT "penalty_shootout_versions_winner_season_entry_id_season_entries_id_fk" FOREIGN KEY ("winner_season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."penalty_shootout_versions" ADD CONSTRAINT "penalty_shootout_versions_supersedes_shootout_id_penalty_shootout_versions_id_fk" FOREIGN KEY ("supersedes_shootout_id") REFERENCES "app"."penalty_shootout_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."played_score_versions" ADD CONSTRAINT "played_score_versions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."played_score_versions" ADD CONSTRAINT "played_score_versions_supersedes_score_id_played_score_versions_id_fk" FOREIGN KEY ("supersedes_score_id") REFERENCES "app"."played_score_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."playing_fields" ADD CONSTRAINT "playing_fields_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "app"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."playoff_fixture_slots" ADD CONSTRAINT "playoff_fixture_slots_fixture_slot_id_fixture_slots_id_fk" FOREIGN KEY ("fixture_slot_id") REFERENCES "app"."fixture_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."replacement_fixture_slots" ADD CONSTRAINT "replacement_fixture_slots_fixture_slot_id_fixture_slots_id_fk" FOREIGN KEY ("fixture_slot_id") REFERENCES "app"."fixture_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."replacement_fixture_slots" ADD CONSTRAINT "replacement_fixture_slots_original_match_id_matches_id_fk" FOREIGN KEY ("original_match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."rest_slots" ADD CONSTRAINT "rest_slots_fixture_round_id_fixture_rounds_id_fk" FOREIGN KEY ("fixture_round_id") REFERENCES "app"."fixture_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."result_rulings" ADD CONSTRAINT "result_rulings_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."result_rulings" ADD CONSTRAINT "result_rulings_supersedes_ruling_id_result_rulings_id_fk" FOREIGN KEY ("supersedes_ruling_id") REFERENCES "app"."result_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."technical_results" ADD CONSTRAINT "technical_results_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."technical_results" ADD CONSTRAINT "technical_results_ruling_id_result_rulings_id_fk" FOREIGN KEY ("ruling_id") REFERENCES "app"."result_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."venue_profile_versions" ADD CONSTRAINT "venue_profile_versions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "app"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."venues" ADD CONSTRAINT "venues_current_profile_version_id_venue_profile_versions_id_fk" FOREIGN KEY ("current_profile_version_id") REFERENCES "app"."venue_profile_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_asset_metadata_versions" ADD CONSTRAINT "media_asset_metadata_versions_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "app"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_asset_metadata_versions" ADD CONSTRAINT "media_asset_metadata_versions_supersedes_version_id_media_asset_metadata_versions_id_fk" FOREIGN KEY ("supersedes_version_id") REFERENCES "app"."media_asset_metadata_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_asset_state_transitions" ADD CONSTRAINT "media_asset_state_transitions_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "app"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_asset_state_transitions" ADD CONSTRAINT "media_asset_state_transitions_processing_attempt_id_media_processing_attempts_id_fk" FOREIGN KEY ("processing_attempt_id") REFERENCES "app"."media_processing_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_asset_variants" ADD CONSTRAINT "media_asset_variants_presentation_id_media_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "app"."media_presentations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_assets" ADD CONSTRAINT "media_assets_upload_intent_id_media_upload_intents_id_fk" FOREIGN KEY ("upload_intent_id") REFERENCES "app"."media_upload_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_assets" ADD CONSTRAINT "media_assets_current_metadata_version_id_media_asset_metadata_versions_id_fk" FOREIGN KEY ("current_metadata_version_id") REFERENCES "app"."media_asset_metadata_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_assets" ADD CONSTRAINT "media_assets_current_presentation_id_media_presentations_id_fk" FOREIGN KEY ("current_presentation_id") REFERENCES "app"."media_presentations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_presentations" ADD CONSTRAINT "media_presentations_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "app"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_presentations" ADD CONSTRAINT "media_presentations_supersedes_presentation_id_media_presentations_id_fk" FOREIGN KEY ("supersedes_presentation_id") REFERENCES "app"."media_presentations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_processing_attempts" ADD CONSTRAINT "media_processing_attempts_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "app"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_processing_attempts" ADD CONSTRAINT "media_processing_attempts_presentation_id_media_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "app"."media_presentations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_storage_tombstones" ADD CONSTRAINT "media_storage_tombstones_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "app"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_storage_tombstones" ADD CONSTRAINT "media_storage_tombstones_variant_id_media_asset_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "app"."media_asset_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_withdrawal_decisions" ADD CONSTRAINT "media_withdrawal_decisions_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "app"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media_withdrawal_decisions" ADD CONSTRAINT "media_withdrawal_decisions_supersedes_decision_id_media_withdrawal_decisions_id_fk" FOREIGN KEY ("supersedes_decision_id") REFERENCES "app"."media_withdrawal_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."incident_state_transitions" ADD CONSTRAINT "incident_state_transitions_incident_id_incident_records_id_fk" FOREIGN KEY ("incident_id") REFERENCES "app"."incident_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."job_runs" ADD CONSTRAINT "job_runs_job_id_scheduled_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "app"."scheduled_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."operational_alerts" ADD CONSTRAINT "operational_alerts_incident_id_incident_records_id_fk" FOREIGN KEY ("incident_id") REFERENCES "app"."incident_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."restore_validations" ADD CONSTRAINT "restore_validations_recovery_verification_id_recovery_verifications_id_fk" FOREIGN KEY ("recovery_verification_id") REFERENCES "app"."recovery_verifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."restore_validations" ADD CONSTRAINT "restore_validations_admin_identity_id_admin_identities_id_fk" FOREIGN KEY ("admin_identity_id") REFERENCES "app"."admin_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."application_checklist_items" ADD CONSTRAINT "application_checklist_items_application_id_season_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "app"."season_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."application_checklist_items" ADD CONSTRAINT "application_checklist_items_template_id_application_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "app"."application_checklist_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."application_checklist_template_items" ADD CONSTRAINT "application_checklist_template_items_template_id_application_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "app"."application_checklist_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."application_checklist_templates" ADD CONSTRAINT "application_checklist_templates_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."legionnaire_classification_decisions" ADD CONSTRAINT "legionnaire_classification_decisions_roster_entry_id_roster_entries_id_fk" FOREIGN KEY ("roster_entry_id") REFERENCES "app"."roster_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."legionnaire_classification_decisions" ADD CONSTRAINT "legionnaire_classification_decisions_supersedes_decision_id_legionnaire_classification_decisions_id_fk" FOREIGN KEY ("supersedes_decision_id") REFERENCES "app"."legionnaire_classification_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."legionnaire_quota_versions" ADD CONSTRAINT "legionnaire_quota_versions_roster_rule_set_id_roster_rule_sets_id_fk" FOREIGN KEY ("roster_rule_set_id") REFERENCES "app"."roster_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."player_identity_versions" ADD CONSTRAINT "player_identity_versions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "app"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."player_merges" ADD CONSTRAINT "player_merges_retained_player_id_players_id_fk" FOREIGN KEY ("retained_player_id") REFERENCES "app"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."player_merges" ADD CONSTRAINT "player_merges_retired_player_id_players_id_fk" FOREIGN KEY ("retired_player_id") REFERENCES "app"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."player_private_detail_versions" ADD CONSTRAINT "player_private_detail_versions_private_details_id_player_private_details_id_fk" FOREIGN KEY ("private_details_id") REFERENCES "app"."player_private_details"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."player_private_detail_versions" ADD CONSTRAINT "player_private_detail_versions_supersedes_version_id_player_private_detail_versions_id_fk" FOREIGN KEY ("supersedes_version_id") REFERENCES "app"."player_private_detail_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."player_private_details" ADD CONSTRAINT "player_private_details_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "app"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."player_private_details" ADD CONSTRAINT "player_private_details_current_version_id_player_private_detail_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "app"."player_private_detail_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."player_publication_consents" ADD CONSTRAINT "player_publication_consents_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "app"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."player_publication_transitions" ADD CONSTRAINT "player_publication_transitions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "app"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."players" ADD CONSTRAINT "players_current_identity_version_id_player_identity_versions_id_fk" FOREIGN KEY ("current_identity_version_id") REFERENCES "app"."player_identity_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."players" ADD CONSTRAINT "players_merged_into_player_id_players_id_fk" FOREIGN KEY ("merged_into_player_id") REFERENCES "app"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."registration_window_transitions" ADD CONSTRAINT "registration_window_transitions_window_id_registration_windows_id_fk" FOREIGN KEY ("window_id") REFERENCES "app"."registration_windows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."registration_windows" ADD CONSTRAINT "registration_windows_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_eligibility_rulings" ADD CONSTRAINT "roster_eligibility_rulings_roster_entry_id_roster_entries_id_fk" FOREIGN KEY ("roster_entry_id") REFERENCES "app"."roster_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_entries" ADD CONSTRAINT "roster_entries_roster_id_season_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "app"."season_rosters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_entries" ADD CONSTRAINT "roster_entries_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "app"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_entries" ADD CONSTRAINT "roster_entries_current_classification_decision_id_legionnaire_classification_decisions_id_fk" FOREIGN KEY ("current_classification_decision_id") REFERENCES "app"."legionnaire_classification_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_entries" ADD CONSTRAINT "roster_entries_current_decision_id_roster_entry_decisions_id_fk" FOREIGN KEY ("current_decision_id") REFERENCES "app"."roster_entry_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_entry_decisions" ADD CONSTRAINT "roster_entry_decisions_roster_entry_id_roster_entries_id_fk" FOREIGN KEY ("roster_entry_id") REFERENCES "app"."roster_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_readiness_decisions" ADD CONSTRAINT "roster_readiness_decisions_roster_id_season_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "app"."season_rosters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_readiness_decisions" ADD CONSTRAINT "roster_readiness_decisions_rule_set_id_roster_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "app"."roster_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_registration_period_revisions" ADD CONSTRAINT "roster_registration_period_revisions_period_id_roster_registration_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "app"."roster_registration_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_registration_period_revisions" ADD CONSTRAINT "roster_registration_period_revisions_supersedes_revision_id_roster_registration_period_revisions_id_fk" FOREIGN KEY ("supersedes_revision_id") REFERENCES "app"."roster_registration_period_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_registration_periods" ADD CONSTRAINT "roster_registration_periods_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "app"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_registration_periods" ADD CONSTRAINT "roster_registration_periods_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_registration_periods" ADD CONSTRAINT "roster_registration_periods_roster_entry_id_roster_entries_id_fk" FOREIGN KEY ("roster_entry_id") REFERENCES "app"."roster_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_registration_periods" ADD CONSTRAINT "roster_registration_periods_decision_id_roster_entry_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "app"."roster_entry_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_registration_periods" ADD CONSTRAINT "roster_registration_periods_current_revision_id_roster_registration_period_revisions_id_fk" FOREIGN KEY ("current_revision_id") REFERENCES "app"."roster_registration_period_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_rule_sets" ADD CONSTRAINT "roster_rule_sets_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_transfers" ADD CONSTRAINT "roster_transfers_source_roster_entry_id_roster_entries_id_fk" FOREIGN KEY ("source_roster_entry_id") REFERENCES "app"."roster_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_transfers" ADD CONSTRAINT "roster_transfers_destination_roster_entry_id_roster_entries_id_fk" FOREIGN KEY ("destination_roster_entry_id") REFERENCES "app"."roster_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_transfers" ADD CONSTRAINT "roster_transfers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "app"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_transfers" ADD CONSTRAINT "roster_transfers_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roster_transfers" ADD CONSTRAINT "roster_transfers_transfer_window_id_registration_windows_id_fk" FOREIGN KEY ("transfer_window_id") REFERENCES "app"."registration_windows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_application_decisions" ADD CONSTRAINT "season_application_decisions_application_id_season_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "app"."season_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_applications" ADD CONSTRAINT "season_applications_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_applications" ADD CONSTRAINT "season_applications_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_applications" ADD CONSTRAINT "season_applications_current_decision_id_season_application_decisions_id_fk" FOREIGN KEY ("current_decision_id") REFERENCES "app"."season_application_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_applications" ADD CONSTRAINT "season_applications_checklist_template_id_application_checklist_templates_id_fk" FOREIGN KEY ("checklist_template_id") REFERENCES "app"."application_checklist_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_entries" ADD CONSTRAINT "season_entries_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "app"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_entries" ADD CONSTRAINT "season_entries_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_entries" ADD CONSTRAINT "season_entries_approved_application_id_season_applications_id_fk" FOREIGN KEY ("approved_application_id") REFERENCES "app"."season_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_entry_state_transitions" ADD CONSTRAINT "season_entry_state_transitions_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_rosters" ADD CONSTRAINT "season_rosters_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_rosters" ADD CONSTRAINT "season_rosters_current_rule_set_id_roster_rule_sets_id_fk" FOREIGN KEY ("current_rule_set_id") REFERENCES "app"."roster_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."season_rosters" ADD CONSTRAINT "season_rosters_current_readiness_decision_id_roster_readiness_decisions_id_fk" FOREIGN KEY ("current_readiness_decision_id") REFERENCES "app"."roster_readiness_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."team_profile_versions" ADD CONSTRAINT "team_profile_versions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."team_slugs" ADD CONSTRAINT "team_slugs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teams" ADD CONSTRAINT "teams_current_profile_version_id_team_profile_versions_id_fk" FOREIGN KEY ("current_profile_version_id") REFERENCES "app"."team_profile_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teams" ADD CONSTRAINT "teams_current_slug_id_team_slugs_id_fk" FOREIGN KEY ("current_slug_id") REFERENCES "app"."team_slugs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."confirmed_byes" ADD CONSTRAINT "confirmed_byes_source_slot_id_qualification_slots_id_fk" FOREIGN KEY ("source_slot_id") REFERENCES "app"."qualification_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."confirmed_byes" ADD CONSTRAINT "confirmed_byes_destination_slot_id_qualification_slots_id_fk" FOREIGN KEY ("destination_slot_id") REFERENCES "app"."qualification_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."confirmed_byes" ADD CONSTRAINT "confirmed_byes_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."confirmed_byes" ADD CONSTRAINT "confirmed_byes_draw_outcome_id_draw_outcomes_id_fk" FOREIGN KEY ("draw_outcome_id") REFERENCES "app"."draw_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."confirmed_byes" ADD CONSTRAINT "confirmed_byes_supersedes_bye_id_confirmed_byes_id_fk" FOREIGN KEY ("supersedes_bye_id") REFERENCES "app"."confirmed_byes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."cross_group_comparison_rules" ADD CONSTRAINT "cross_group_comparison_rules_ranking_rule_set_id_ranking_rule_sets_id_fk" FOREIGN KEY ("ranking_rule_set_id") REFERENCES "app"."ranking_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."cross_group_tie_breakers" ADD CONSTRAINT "cross_group_tie_breakers_comparison_rule_id_cross_group_comparison_rules_id_fk" FOREIGN KEY ("comparison_rule_id") REFERENCES "app"."cross_group_comparison_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_constraints" ADD CONSTRAINT "draw_constraints_draw_pool_id_draw_pools_id_fk" FOREIGN KEY ("draw_pool_id") REFERENCES "app"."draw_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_constraints" ADD CONSTRAINT "draw_constraints_source_pot_id_draw_pots_id_fk" FOREIGN KEY ("source_pot_id") REFERENCES "app"."draw_pots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_constraints" ADD CONSTRAINT "draw_constraints_target_pot_id_draw_pots_id_fk" FOREIGN KEY ("target_pot_id") REFERENCES "app"."draw_pots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcome_assignments" ADD CONSTRAINT "draw_outcome_assignments_draw_outcome_id_draw_outcomes_id_fk" FOREIGN KEY ("draw_outcome_id") REFERENCES "app"."draw_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcome_assignments" ADD CONSTRAINT "draw_outcome_assignments_draw_pool_entry_id_draw_pool_entries_id_fk" FOREIGN KEY ("draw_pool_entry_id") REFERENCES "app"."draw_pool_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcome_assignments" ADD CONSTRAINT "draw_outcome_assignments_unresolved_source_slot_id_stage_participant_slots_id_fk" FOREIGN KEY ("unresolved_source_slot_id") REFERENCES "app"."stage_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcome_assignments" ADD CONSTRAINT "draw_outcome_assignments_tie_participant_slot_id_knockout_tie_participant_slots_id_fk" FOREIGN KEY ("tie_participant_slot_id") REFERENCES "app"."knockout_tie_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcome_draft_assignments" ADD CONSTRAINT "draw_outcome_draft_assignments_draft_id_draw_outcome_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "app"."draw_outcome_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcome_draft_assignments" ADD CONSTRAINT "draw_outcome_draft_assignments_draw_pool_entry_id_draw_pool_entries_id_fk" FOREIGN KEY ("draw_pool_entry_id") REFERENCES "app"."draw_pool_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcome_draft_assignments" ADD CONSTRAINT "draw_outcome_draft_assignments_unresolved_source_slot_id_stage_participant_slots_id_fk" FOREIGN KEY ("unresolved_source_slot_id") REFERENCES "app"."stage_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcome_draft_assignments" ADD CONSTRAINT "draw_outcome_draft_assignments_tie_participant_slot_id_knockout_tie_participant_slots_id_fk" FOREIGN KEY ("tie_participant_slot_id") REFERENCES "app"."knockout_tie_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcome_drafts" ADD CONSTRAINT "draw_outcome_drafts_round_id_knockout_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "app"."knockout_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcome_drafts" ADD CONSTRAINT "draw_outcome_drafts_round_version_id_knockout_round_versions_id_fk" FOREIGN KEY ("round_version_id") REFERENCES "app"."knockout_round_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcomes" ADD CONSTRAINT "draw_outcomes_round_id_knockout_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "app"."knockout_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcomes" ADD CONSTRAINT "draw_outcomes_round_version_id_knockout_round_versions_id_fk" FOREIGN KEY ("round_version_id") REFERENCES "app"."knockout_round_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_outcomes" ADD CONSTRAINT "draw_outcomes_supersedes_outcome_id_draw_outcomes_id_fk" FOREIGN KEY ("supersedes_outcome_id") REFERENCES "app"."draw_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_pool_entries" ADD CONSTRAINT "draw_pool_entries_draw_pool_id_draw_pools_id_fk" FOREIGN KEY ("draw_pool_id") REFERENCES "app"."draw_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_pool_entries" ADD CONSTRAINT "draw_pool_entries_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_pool_entries" ADD CONSTRAINT "draw_pool_entries_source_qualification_output_id_qualification_outputs_id_fk" FOREIGN KEY ("source_qualification_output_id") REFERENCES "app"."qualification_outputs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_pool_entries" ADD CONSTRAINT "draw_pool_entries_unresolved_source_slot_id_stage_participant_slots_id_fk" FOREIGN KEY ("unresolved_source_slot_id") REFERENCES "app"."stage_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_pool_entries" ADD CONSTRAINT "draw_pool_entries_pot_id_draw_pots_id_fk" FOREIGN KEY ("pot_id") REFERENCES "app"."draw_pots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_pools" ADD CONSTRAINT "draw_pools_round_version_id_knockout_round_versions_id_fk" FOREIGN KEY ("round_version_id") REFERENCES "app"."knockout_round_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draw_pots" ADD CONSTRAINT "draw_pots_draw_pool_id_draw_pools_id_fk" FOREIGN KEY ("draw_pool_id") REFERENCES "app"."draw_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fair_play_weight_sets" ADD CONSTRAINT "fair_play_weight_sets_ranking_rule_set_id_ranking_rule_sets_id_fk" FOREIGN KEY ("ranking_rule_set_id") REFERENCES "app"."ranking_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_knockout_evidence" ADD CONSTRAINT "final_knockout_evidence_snapshot_id_final_knockout_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "app"."final_knockout_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_knockout_evidence" ADD CONSTRAINT "final_knockout_evidence_tie_version_id_knockout_tie_versions_id_fk" FOREIGN KEY ("tie_version_id") REFERENCES "app"."knockout_tie_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_knockout_evidence" ADD CONSTRAINT "final_knockout_evidence_tie_outcome_id_tie_outcomes_id_fk" FOREIGN KEY ("tie_outcome_id") REFERENCES "app"."tie_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_knockout_evidence" ADD CONSTRAINT "final_knockout_evidence_draw_outcome_id_draw_outcomes_id_fk" FOREIGN KEY ("draw_outcome_id") REFERENCES "app"."draw_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_knockout_evidence" ADD CONSTRAINT "final_knockout_evidence_confirmed_bye_id_confirmed_byes_id_fk" FOREIGN KEY ("confirmed_bye_id") REFERENCES "app"."confirmed_byes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_knockout_evidence" ADD CONSTRAINT "final_knockout_evidence_tie_ruling_id_tie_rulings_id_fk" FOREIGN KEY ("tie_ruling_id") REFERENCES "app"."tie_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_knockout_evidence" ADD CONSTRAINT "final_knockout_evidence_placement_output_id_placement_outputs_id_fk" FOREIGN KEY ("placement_output_id") REFERENCES "app"."placement_outputs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_knockout_evidence" ADD CONSTRAINT "final_knockout_evidence_qualification_output_id_qualification_outputs_id_fk" FOREIGN KEY ("qualification_output_id") REFERENCES "app"."qualification_outputs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_knockout_snapshots" ADD CONSTRAINT "final_knockout_snapshots_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_knockout_snapshots" ADD CONSTRAINT "final_knockout_snapshots_stage_version_id_competition_stage_versions_id_fk" FOREIGN KEY ("stage_version_id") REFERENCES "app"."competition_stage_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_knockout_snapshots" ADD CONSTRAINT "final_knockout_snapshots_supersedes_snapshot_id_final_knockout_snapshots_id_fk" FOREIGN KEY ("supersedes_snapshot_id") REFERENCES "app"."final_knockout_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_evidence" ADD CONSTRAINT "final_standings_evidence_snapshot_id_final_standings_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "app"."final_standings_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_evidence" ADD CONSTRAINT "final_standings_evidence_match_result_version_id_match_result_versions_id_fk" FOREIGN KEY ("match_result_version_id") REFERENCES "app"."match_result_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_evidence" ADD CONSTRAINT "final_standings_evidence_disciplinary_summary_version_id_disciplinary_summary_versions_id_fk" FOREIGN KEY ("disciplinary_summary_version_id") REFERENCES "app"."disciplinary_summary_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_evidence" ADD CONSTRAINT "final_standings_evidence_standing_adjustment_decision_id_standing_adjustment_decisions_id_fk" FOREIGN KEY ("standing_adjustment_decision_id") REFERENCES "app"."standing_adjustment_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_evidence" ADD CONSTRAINT "final_standings_evidence_playoff_match_result_version_id_match_result_versions_id_fk" FOREIGN KEY ("playoff_match_result_version_id") REFERENCES "app"."match_result_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_evidence" ADD CONSTRAINT "final_standings_evidence_ranking_ruling_id_ranking_rulings_id_fk" FOREIGN KEY ("ranking_ruling_id") REFERENCES "app"."ranking_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_rows" ADD CONSTRAINT "final_standings_rows_snapshot_id_final_standings_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "app"."final_standings_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_rows" ADD CONSTRAINT "final_standings_rows_group_id_stage_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."stage_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_rows" ADD CONSTRAINT "final_standings_rows_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_snapshots" ADD CONSTRAINT "final_standings_snapshots_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_snapshots" ADD CONSTRAINT "final_standings_snapshots_stage_version_id_competition_stage_versions_id_fk" FOREIGN KEY ("stage_version_id") REFERENCES "app"."competition_stage_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_snapshots" ADD CONSTRAINT "final_standings_snapshots_ranking_rule_set_id_ranking_rule_sets_id_fk" FOREIGN KEY ("ranking_rule_set_id") REFERENCES "app"."ranking_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."final_standings_snapshots" ADD CONSTRAINT "final_standings_snapshots_supersedes_snapshot_id_final_standings_snapshots_id_fk" FOREIGN KEY ("supersedes_snapshot_id") REFERENCES "app"."final_standings_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_round_versions" ADD CONSTRAINT "knockout_round_versions_round_id_knockout_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "app"."knockout_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_round_versions" ADD CONSTRAINT "knockout_round_versions_stage_version_id_competition_stage_versions_id_fk" FOREIGN KEY ("stage_version_id") REFERENCES "app"."competition_stage_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_round_versions" ADD CONSTRAINT "knockout_round_versions_tie_resolution_rule_set_id_tie_resolution_rule_sets_id_fk" FOREIGN KEY ("tie_resolution_rule_set_id") REFERENCES "app"."tie_resolution_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_rounds" ADD CONSTRAINT "knockout_rounds_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_rounds" ADD CONSTRAINT "knockout_rounds_current_version_id_knockout_round_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "app"."knockout_round_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_tie_participant_slots" ADD CONSTRAINT "knockout_tie_participant_slots_tie_id_knockout_ties_id_fk" FOREIGN KEY ("tie_id") REFERENCES "app"."knockout_ties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_tie_participant_slots" ADD CONSTRAINT "knockout_tie_participant_slots_source_qualification_slot_id_qualification_slots_id_fk" FOREIGN KEY ("source_qualification_slot_id") REFERENCES "app"."qualification_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_tie_participant_slots" ADD CONSTRAINT "knockout_tie_participant_slots_source_stage_participant_slot_id_stage_participant_slots_id_fk" FOREIGN KEY ("source_stage_participant_slot_id") REFERENCES "app"."stage_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_tie_participant_slots" ADD CONSTRAINT "knockout_tie_participant_slots_current_season_entry_id_season_entries_id_fk" FOREIGN KEY ("current_season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_tie_participant_slots" ADD CONSTRAINT "knockout_tie_participant_slots_current_draw_assignment_id_draw_outcome_assignments_id_fk" FOREIGN KEY ("current_draw_assignment_id") REFERENCES "app"."draw_outcome_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_tie_versions" ADD CONSTRAINT "knockout_tie_versions_tie_id_knockout_ties_id_fk" FOREIGN KEY ("tie_id") REFERENCES "app"."knockout_ties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_tie_versions" ADD CONSTRAINT "knockout_tie_versions_round_version_id_knockout_round_versions_id_fk" FOREIGN KEY ("round_version_id") REFERENCES "app"."knockout_round_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_tie_versions" ADD CONSTRAINT "knockout_tie_versions_home_slot_id_knockout_tie_participant_slots_id_fk" FOREIGN KEY ("home_slot_id") REFERENCES "app"."knockout_tie_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_tie_versions" ADD CONSTRAINT "knockout_tie_versions_away_slot_id_knockout_tie_participant_slots_id_fk" FOREIGN KEY ("away_slot_id") REFERENCES "app"."knockout_tie_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_tie_versions" ADD CONSTRAINT "knockout_tie_versions_winner_destination_slot_id_qualification_slots_id_fk" FOREIGN KEY ("winner_destination_slot_id") REFERENCES "app"."qualification_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_tie_versions" ADD CONSTRAINT "knockout_tie_versions_loser_destination_slot_id_qualification_slots_id_fk" FOREIGN KEY ("loser_destination_slot_id") REFERENCES "app"."qualification_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_ties" ADD CONSTRAINT "knockout_ties_round_id_knockout_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "app"."knockout_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_ties" ADD CONSTRAINT "knockout_ties_current_version_id_knockout_tie_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "app"."knockout_tie_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_ties" ADD CONSTRAINT "knockout_ties_current_ruling_id_tie_rulings_id_fk" FOREIGN KEY ("current_ruling_id") REFERENCES "app"."tie_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."knockout_ties" ADD CONSTRAINT "knockout_ties_current_outcome_id_tie_outcomes_id_fk" FOREIGN KEY ("current_outcome_id") REFERENCES "app"."tie_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."placement_outputs" ADD CONSTRAINT "placement_outputs_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."placement_outputs" ADD CONSTRAINT "placement_outputs_tie_outcome_id_tie_outcomes_id_fk" FOREIGN KEY ("tie_outcome_id") REFERENCES "app"."tie_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."placement_outputs" ADD CONSTRAINT "placement_outputs_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."points_schemes" ADD CONSTRAINT "points_schemes_ranking_rule_set_id_ranking_rule_sets_id_fk" FOREIGN KEY ("ranking_rule_set_id") REFERENCES "app"."ranking_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_outputs" ADD CONSTRAINT "qualification_outputs_source_final_standings_snapshot_id_final_standings_snapshots_id_fk" FOREIGN KEY ("source_final_standings_snapshot_id") REFERENCES "app"."final_standings_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_outputs" ADD CONSTRAINT "qualification_outputs_source_final_knockout_snapshot_id_final_knockout_snapshots_id_fk" FOREIGN KEY ("source_final_knockout_snapshot_id") REFERENCES "app"."final_knockout_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_outputs" ADD CONSTRAINT "qualification_outputs_destination_slot_id_qualification_slots_id_fk" FOREIGN KEY ("destination_slot_id") REFERENCES "app"."qualification_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_outputs" ADD CONSTRAINT "qualification_outputs_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_outputs" ADD CONSTRAINT "qualification_outputs_qualification_ruling_id_qualification_rulings_id_fk" FOREIGN KEY ("qualification_ruling_id") REFERENCES "app"."qualification_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_outputs" ADD CONSTRAINT "qualification_outputs_supersedes_output_id_qualification_outputs_id_fk" FOREIGN KEY ("supersedes_output_id") REFERENCES "app"."qualification_outputs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_rules" ADD CONSTRAINT "qualification_rules_ranking_rule_set_id_ranking_rule_sets_id_fk" FOREIGN KEY ("ranking_rule_set_id") REFERENCES "app"."ranking_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_rules" ADD CONSTRAINT "qualification_rules_source_group_id_stage_groups_id_fk" FOREIGN KEY ("source_group_id") REFERENCES "app"."stage_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_rules" ADD CONSTRAINT "qualification_rules_comparison_rule_id_cross_group_comparison_rules_id_fk" FOREIGN KEY ("comparison_rule_id") REFERENCES "app"."cross_group_comparison_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_rules" ADD CONSTRAINT "qualification_rules_destination_slot_id_qualification_slots_id_fk" FOREIGN KEY ("destination_slot_id") REFERENCES "app"."qualification_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_rules" ADD CONSTRAINT "qualification_rules_destination_draw_pool_id_draw_pools_id_fk" FOREIGN KEY ("destination_draw_pool_id") REFERENCES "app"."draw_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_rulings" ADD CONSTRAINT "qualification_rulings_source_snapshot_id_final_standings_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "app"."final_standings_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_rulings" ADD CONSTRAINT "qualification_rulings_calculated_season_entry_id_season_entries_id_fk" FOREIGN KEY ("calculated_season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_rulings" ADD CONSTRAINT "qualification_rulings_replacement_season_entry_id_season_entries_id_fk" FOREIGN KEY ("replacement_season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_rulings" ADD CONSTRAINT "qualification_rulings_supersedes_ruling_id_qualification_rulings_id_fk" FOREIGN KEY ("supersedes_ruling_id") REFERENCES "app"."qualification_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_slots" ADD CONSTRAINT "qualification_slots_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_slots" ADD CONSTRAINT "qualification_slots_knockout_round_id_knockout_rounds_id_fk" FOREIGN KEY ("knockout_round_id") REFERENCES "app"."knockout_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."qualification_slots" ADD CONSTRAINT "qualification_slots_knockout_tie_id_knockout_ties_id_fk" FOREIGN KEY ("knockout_tie_id") REFERENCES "app"."knockout_ties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ranking_rule_sets" ADD CONSTRAINT "ranking_rule_sets_stage_version_id_competition_stage_versions_id_fk" FOREIGN KEY ("stage_version_id") REFERENCES "app"."competition_stage_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ranking_ruling_positions" ADD CONSTRAINT "ranking_ruling_positions_ruling_id_ranking_rulings_id_fk" FOREIGN KEY ("ruling_id") REFERENCES "app"."ranking_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ranking_ruling_positions" ADD CONSTRAINT "ranking_ruling_positions_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ranking_rulings" ADD CONSTRAINT "ranking_rulings_tie_case_id_ranking_tie_cases_id_fk" FOREIGN KEY ("tie_case_id") REFERENCES "app"."ranking_tie_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ranking_rulings" ADD CONSTRAINT "ranking_rulings_supersedes_ruling_id_ranking_rulings_id_fk" FOREIGN KEY ("supersedes_ruling_id") REFERENCES "app"."ranking_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ranking_tie_case_entries" ADD CONSTRAINT "ranking_tie_case_entries_tie_case_id_ranking_tie_cases_id_fk" FOREIGN KEY ("tie_case_id") REFERENCES "app"."ranking_tie_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ranking_tie_case_entries" ADD CONSTRAINT "ranking_tie_case_entries_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ranking_tie_cases" ADD CONSTRAINT "ranking_tie_cases_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ranking_tie_cases" ADD CONSTRAINT "ranking_tie_cases_group_id_stage_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."stage_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ranking_tie_cases" ADD CONSTRAINT "ranking_tie_cases_ranking_rule_set_id_ranking_rule_sets_id_fk" FOREIGN KEY ("ranking_rule_set_id") REFERENCES "app"."ranking_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_participant_assignments" ADD CONSTRAINT "stage_participant_assignments_slot_id_stage_participant_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "app"."stage_participant_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_participant_assignments" ADD CONSTRAINT "stage_participant_assignments_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_participant_assignments" ADD CONSTRAINT "stage_participant_assignments_source_qualification_output_id_qualification_outputs_id_fk" FOREIGN KEY ("source_qualification_output_id") REFERENCES "app"."qualification_outputs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_participant_assignments" ADD CONSTRAINT "stage_participant_assignments_source_draw_outcome_assignment_id_draw_outcome_assignments_id_fk" FOREIGN KEY ("source_draw_outcome_assignment_id") REFERENCES "app"."draw_outcome_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_participant_assignments" ADD CONSTRAINT "stage_participant_assignments_supersedes_assignment_id_stage_participant_assignments_id_fk" FOREIGN KEY ("supersedes_assignment_id") REFERENCES "app"."stage_participant_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_participant_slots" ADD CONSTRAINT "stage_participant_slots_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_participant_slots" ADD CONSTRAINT "stage_participant_slots_stage_version_id_competition_stage_versions_id_fk" FOREIGN KEY ("stage_version_id") REFERENCES "app"."competition_stage_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stage_participant_slots" ADD CONSTRAINT "stage_participant_slots_current_assignment_id_stage_participant_assignments_id_fk" FOREIGN KEY ("current_assignment_id") REFERENCES "app"."stage_participant_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standing_adjustment_decisions" ADD CONSTRAINT "standing_adjustment_decisions_stage_id_competition_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "app"."competition_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standing_adjustment_decisions" ADD CONSTRAINT "standing_adjustment_decisions_season_entry_id_season_entries_id_fk" FOREIGN KEY ("season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."standing_adjustment_decisions" ADD CONSTRAINT "standing_adjustment_decisions_supersedes_decision_id_standing_adjustment_decisions_id_fk" FOREIGN KEY ("supersedes_decision_id") REFERENCES "app"."standing_adjustment_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_breakers" ADD CONSTRAINT "tie_breakers_ranking_rule_set_id_ranking_rule_sets_id_fk" FOREIGN KEY ("ranking_rule_set_id") REFERENCES "app"."ranking_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_outcomes" ADD CONSTRAINT "tie_outcomes_tie_id_knockout_ties_id_fk" FOREIGN KEY ("tie_id") REFERENCES "app"."knockout_ties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_outcomes" ADD CONSTRAINT "tie_outcomes_tie_version_id_knockout_tie_versions_id_fk" FOREIGN KEY ("tie_version_id") REFERENCES "app"."knockout_tie_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_outcomes" ADD CONSTRAINT "tie_outcomes_rule_set_id_tie_resolution_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "app"."tie_resolution_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_outcomes" ADD CONSTRAINT "tie_outcomes_first_match_result_version_id_match_result_versions_id_fk" FOREIGN KEY ("first_match_result_version_id") REFERENCES "app"."match_result_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_outcomes" ADD CONSTRAINT "tie_outcomes_second_leg_result_version_id_match_result_versions_id_fk" FOREIGN KEY ("second_leg_result_version_id") REFERENCES "app"."match_result_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_outcomes" ADD CONSTRAINT "tie_outcomes_replay_result_version_id_match_result_versions_id_fk" FOREIGN KEY ("replay_result_version_id") REFERENCES "app"."match_result_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_outcomes" ADD CONSTRAINT "tie_outcomes_decisive_shootout_version_id_penalty_shootout_versions_id_fk" FOREIGN KEY ("decisive_shootout_version_id") REFERENCES "app"."penalty_shootout_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_outcomes" ADD CONSTRAINT "tie_outcomes_tie_ruling_id_tie_rulings_id_fk" FOREIGN KEY ("tie_ruling_id") REFERENCES "app"."tie_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_outcomes" ADD CONSTRAINT "tie_outcomes_winner_season_entry_id_season_entries_id_fk" FOREIGN KEY ("winner_season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_outcomes" ADD CONSTRAINT "tie_outcomes_supersedes_outcome_id_tie_outcomes_id_fk" FOREIGN KEY ("supersedes_outcome_id") REFERENCES "app"."tie_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_resolution_rule_sets" ADD CONSTRAINT "tie_resolution_rule_sets_round_id_knockout_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "app"."knockout_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_resolution_steps" ADD CONSTRAINT "tie_resolution_steps_rule_set_id_tie_resolution_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "app"."tie_resolution_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_rulings" ADD CONSTRAINT "tie_rulings_tie_id_knockout_ties_id_fk" FOREIGN KEY ("tie_id") REFERENCES "app"."knockout_ties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_rulings" ADD CONSTRAINT "tie_rulings_winner_season_entry_id_season_entries_id_fk" FOREIGN KEY ("winner_season_entry_id") REFERENCES "app"."season_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_rulings" ADD CONSTRAINT "tie_rulings_supersedes_ruling_id_tie_rulings_id_fk" FOREIGN KEY ("supersedes_ruling_id") REFERENCES "app"."tie_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_state_transitions" ADD CONSTRAINT "tie_state_transitions_tie_id_knockout_ties_id_fk" FOREIGN KEY ("tie_id") REFERENCES "app"."knockout_ties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tie_state_transitions" ADD CONSTRAINT "tie_state_transitions_ruling_id_tie_rulings_id_fk" FOREIGN KEY ("ruling_id") REFERENCES "app"."tie_rulings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competition_profile_versions_owner_idx" ON "app"."competition_profile_versions" USING btree ("competition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competition_slugs_normalized_uq" ON "app"."competition_slugs" USING btree ("normalized_slug");--> statement-breakpoint
CREATE INDEX "competition_slugs_owner_idx" ON "app"."competition_slugs" USING btree ("competition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "season_slugs_competition_normalized_uq" ON "app"."season_slugs" USING btree ("competition_id","normalized_slug");--> statement-breakpoint
CREATE INDEX "seasons_competition_state_idx" ON "app"."seasons" USING btree ("competition_id","visibility","sporting_state");--> statement-breakpoint
CREATE UNIQUE INDEX "article_categories_normalized_slug_uq" ON "app"."article_categories" USING btree ("normalized_slug");--> statement-breakpoint
CREATE INDEX "article_publication_schedules_due_idx" ON "app"."article_publication_schedules" USING btree ("state","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "article_slugs_normalized_uq" ON "app"."article_slugs" USING btree ("normalized_slug");--> statement-breakpoint
CREATE INDEX "news_articles_state_published_idx" ON "app"."news_articles" USING btree ("lifecycle_state","first_published_at");--> statement-breakpoint
CREATE INDEX "audit_event_targets_lookup_idx" ON "app"."audit_event_targets" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_time_idx" ON "app"."audit_events" USING btree ("actor_admin_identity_id","recorded_at");--> statement-breakpoint
CREATE INDEX "audit_events_action_time_idx" ON "app"."audit_events" USING btree ("action","recorded_at");--> statement-breakpoint
CREATE INDEX "legal_hold_targets_lookup_idx" ON "app"."legal_hold_targets" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "privacy_deletion_ledger_target_idx" ON "app"."privacy_deletion_ledger" USING btree ("opaque_target_hash");--> statement-breakpoint
CREATE INDEX "privacy_request_items_target_idx" ON "app"."privacy_request_items" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "privacy_requests_state_due_idx" ON "app"."privacy_requests" USING btree ("state","resolution_due_at");--> statement-breakpoint
CREATE INDEX "private_documents_owner_idx" ON "app"."private_documents" USING btree ("owner_module","owner_record_id");--> statement-breakpoint
CREATE INDEX "retention_candidates_due_idx" ON "app"."retention_candidates" USING btree ("review_state","due_at");--> statement-breakpoint
CREATE INDEX "security_event_contexts_expiry_idx" ON "app"."security_event_contexts" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_access_grants_current_uq" ON "app"."admin_access_grants" USING btree ("admin_identity_id") WHERE "app"."admin_access_grants"."state" in ('invited', 'active', 'suspended');--> statement-breakpoint
CREATE INDEX "admin_identities_email_idx" ON "app"."admin_identities" USING btree ("normalized_email");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitations_provider_id_uq" ON "app"."admin_invitations" USING btree ("provider_invitation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitations_pending_email_uq" ON "app"."admin_invitations" USING btree ("normalized_email") WHERE "app"."admin_invitations"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "match_participant_occupancies_entry_idx" ON "app"."match_participant_occupancies" USING btree ("season_entry_id");--> statement-breakpoint
CREATE INDEX "match_schedule_revisions_match_time_idx" ON "app"."match_schedule_revisions" USING btree ("match_id","published_at");--> statement-breakpoint
CREATE INDEX "matches_stage_visibility_state_idx" ON "app"."matches" USING btree ("stage_id","visibility","sporting_state");--> statement-breakpoint
CREATE UNIQUE INDEX "playing_fields_default_per_venue_uq" ON "app"."playing_fields" USING btree ("venue_id") WHERE "app"."playing_fields"."is_default";--> statement-breakpoint
CREATE INDEX "media_assets_state_idx" ON "app"."media_assets" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "media_storage_tombstones_key_hash_uq" ON "app"."media_storage_tombstones" USING btree ("object_key_hash");--> statement-breakpoint
CREATE INDEX "incident_records_state_idx" ON "app"."incident_records" USING btree ("state","severity");--> statement-breakpoint
CREATE INDEX "operational_alerts_state_idx" ON "app"."operational_alerts" USING btree ("state","severity");--> statement-breakpoint
CREATE INDEX "outbox_messages_claim_idx" ON "app"."outbox_messages" USING btree ("state","available_at");--> statement-breakpoint
CREATE INDEX "scheduled_jobs_claim_idx" ON "app"."scheduled_jobs" USING btree ("state","due_at");--> statement-breakpoint
CREATE INDEX "player_identity_versions_search_idx" ON "app"."player_identity_versions" USING btree ("normalized_search_name");--> statement-breakpoint
CREATE INDEX "registration_windows_season_type_state_idx" ON "app"."registration_windows" USING btree ("season_id","window_type","state");--> statement-breakpoint
CREATE INDEX "roster_entries_roster_state_idx" ON "app"."roster_entries" USING btree ("roster_id","state");--> statement-breakpoint
CREATE INDEX "roster_entries_player_idx" ON "app"."roster_entries" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "roster_registration_periods_entry_idx" ON "app"."roster_registration_periods" USING btree ("roster_entry_id");--> statement-breakpoint
CREATE INDEX "season_applications_season_state_idx" ON "app"."season_applications" USING btree ("season_id","state");--> statement-breakpoint
CREATE INDEX "season_applications_team_idx" ON "app"."season_applications" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "season_entries_team_idx" ON "app"."season_entries" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_slugs_normalized_uq" ON "app"."team_slugs" USING btree ("normalized_slug");--> statement-breakpoint
CREATE INDEX "team_slugs_owner_idx" ON "app"."team_slugs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "final_standings_rows_position_idx" ON "app"."final_standings_rows" USING btree ("snapshot_id","group_id","position");
--> statement-breakpoint
-- Reviewed PostgreSQL-only constraints, intentionally outside Drizzle's schema DSL.
-- Typed cross-module final snapshots retain one stage-owned current reference.
ALTER TABLE app.competition_stages ADD CONSTRAINT competition_stages_final_standings_fk
  FOREIGN KEY (current_final_standings_snapshot_id)
  REFERENCES app.final_standings_snapshots(id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE app.competition_stages ADD CONSTRAINT competition_stages_final_knockout_fk
  FOREIGN KEY (current_final_knockout_snapshot_id)
  REFERENCES app.final_knockout_snapshots(id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE FUNCTION app.check_stage_final_snapshot_kind() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, app AS $$
DECLARE current_stage record; current_format_type text; snapshot_version_id uuid;
BEGIN
  -- Read the transaction's final stage state, not an intermediate deferred event.
  SELECT * INTO current_stage FROM app.competition_stages WHERE id = NEW.id;
  IF NOT FOUND OR current_stage.sporting_state <> 'finalized' THEN RETURN NULL; END IF;
  SELECT format_type INTO current_format_type FROM app.competition_stage_versions
    WHERE id = current_stage.current_version_id AND stage_id = current_stage.id;
  IF current_format_type IS NULL THEN
    RAISE EXCEPTION 'finalized stage % requires an owned current version', current_stage.id
      USING ERRCODE = '23514', CONSTRAINT = 'competition_stages_final_version_ck';
  END IF;
  IF current_format_type = 'league' THEN
    SELECT stage_version_id INTO snapshot_version_id FROM app.final_standings_snapshots
      WHERE id = current_stage.current_final_standings_snapshot_id AND stage_id = current_stage.id;
  ELSE
    SELECT stage_version_id INTO snapshot_version_id FROM app.final_knockout_snapshots
      WHERE id = current_stage.current_final_knockout_snapshot_id AND stage_id = current_stage.id;
  END IF;
  IF snapshot_version_id IS DISTINCT FROM current_stage.current_version_id THEN
    RAISE EXCEPTION 'stage % final snapshot must match its format and current version', current_stage.id
      USING ERRCODE = '23514', CONSTRAINT = 'competition_stages_final_snapshot_kind_ck';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER competition_stages_final_snapshot_kind_ck
  AFTER INSERT OR UPDATE ON app.competition_stages
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION app.check_stage_final_snapshot_kind();
--> statement-breakpoint
ALTER TABLE app.stage_state_transitions ADD CONSTRAINT stage_state_transitions_result_ruling_fk
  FOREIGN KEY (result_ruling_id) REFERENCES app.result_rulings(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE app.stage_state_transitions ADD CONSTRAINT stage_state_transitions_qualification_ruling_fk
  FOREIGN KEY (qualification_ruling_id) REFERENCES app.qualification_rulings(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE app.stage_state_transitions ADD CONSTRAINT stage_state_transitions_ranking_ruling_fk
  FOREIGN KEY (ranking_ruling_id) REFERENCES app.ranking_rulings(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE app.stage_state_transitions ADD CONSTRAINT stage_state_transitions_tie_ruling_fk
  FOREIGN KEY (tie_ruling_id) REFERENCES app.tie_rulings(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE app.roster_registration_periods
  ADD CONSTRAINT roster_registration_periods_no_approved_overlap
  EXCLUDE USING gist (player_id WITH =, season_id WITH =, effective_period WITH &&)
  WHERE (approval_state = 'approved');
--> statement-breakpoint
ALTER TABLE app.match_participant_occupancies
  ADD CONSTRAINT match_participant_occupancies_no_overlap
  EXCLUDE USING gist (season_entry_id WITH =, planned_period WITH &&);
--> statement-breakpoint
CREATE FUNCTION app.check_fixture_slot_specialization() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, app AS $$
DECLARE slot_id uuid; expected_type text; actual_count integer; matching_count integer;
BEGIN
  IF TG_TABLE_NAME = 'fixture_slots' THEN
    slot_id := NEW.id;
  ELSE
    slot_id := COALESCE(NEW.fixture_slot_id, OLD.fixture_slot_id);
  END IF;
  SELECT slot_type INTO expected_type FROM app.fixture_slots WHERE id = slot_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*), count(*) FILTER (WHERE kind = expected_type)
    INTO actual_count, matching_count
  FROM (
    SELECT 'league' AS kind FROM app.league_fixture_slots WHERE fixture_slot_id = slot_id
    UNION ALL SELECT 'knockout' FROM app.knockout_fixture_slots WHERE fixture_slot_id = slot_id
    UNION ALL SELECT 'playoff' FROM app.playoff_fixture_slots WHERE fixture_slot_id = slot_id
    UNION ALL SELECT 'replacement' FROM app.replacement_fixture_slots WHERE fixture_slot_id = slot_id
  ) AS specializations;
  IF actual_count <> 1 OR matching_count <> 1 THEN
    RAISE EXCEPTION 'fixture slot % requires exactly one matching specialization', slot_id
      USING ERRCODE = '23514', CONSTRAINT = 'fixture_slots_exactly_one_specialization';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fixture_slots_specialization_ck AFTER INSERT OR UPDATE ON app.fixture_slots
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_fixture_slot_specialization();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER league_fixture_slots_specialization_ck AFTER INSERT OR UPDATE OR DELETE ON app.league_fixture_slots
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_fixture_slot_specialization();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER knockout_fixture_slots_specialization_ck AFTER INSERT OR UPDATE OR DELETE ON app.knockout_fixture_slots
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_fixture_slot_specialization();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER playoff_fixture_slots_specialization_ck AFTER INSERT OR UPDATE OR DELETE ON app.playoff_fixture_slots
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_fixture_slot_specialization();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER replacement_fixture_slots_specialization_ck AFTER INSERT OR UPDATE OR DELETE ON app.replacement_fixture_slots
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_fixture_slot_specialization();
--> statement-breakpoint
-- For every direct current-pointer FK, follow the target's FK back to its owner.
-- Add the composite target key where needed and a deferred (owner ID, pointer) FK.
DO $$ DECLARE link record; key_name text; pointer_name text;
BEGIN
  FOR link IN
    SELECT source.oid AS source_oid, target.oid AS target_oid,
      source.relname AS source_name, target.relname AS target_name,
      pointer.attname AS pointer_column, owner.attname AS owner_column
    FROM pg_constraint pointer_fk
    JOIN pg_class source ON source.oid = pointer_fk.conrelid
    JOIN pg_class target ON target.oid = pointer_fk.confrelid
    JOIN pg_namespace ns ON ns.oid = source.relnamespace AND ns.nspname = 'app'
    JOIN pg_attribute pointer ON pointer.attrelid = source.oid AND pointer.attnum = pointer_fk.conkey[1]
    JOIN pg_constraint owner_fk ON owner_fk.conrelid = target.oid
      AND owner_fk.confrelid = source.oid AND owner_fk.contype = 'f'
      AND cardinality(owner_fk.conkey) = 1 AND cardinality(owner_fk.confkey) = 1
    JOIN pg_attribute owner ON owner.attrelid = target.oid AND owner.attnum = owner_fk.conkey[1]
    WHERE pointer_fk.contype = 'f' AND cardinality(pointer_fk.conkey) = 1
      AND pointer.attname LIKE 'current_%'
  LOOP
    key_name := 'owner_key_' || substr(md5(link.target_name || ':' || link.owner_column), 1, 16);
    pointer_name := 'owner_pointer_' || substr(md5(link.source_name || ':' || link.pointer_column), 1, 16);
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = link.target_oid AND c.contype IN ('u', 'p')
        AND pg_get_constraintdef(c.oid) LIKE format('UNIQUE (%I, id)%%', link.owner_column)
    ) THEN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = link.target_oid AND conname = key_name) THEN
        EXECUTE format('ALTER TABLE app.%I ADD CONSTRAINT %I UNIQUE (%I, id)',
          link.target_name, key_name, link.owner_column);
      END IF;
    END IF;
    EXECUTE format('ALTER TABLE app.%I ADD CONSTRAINT %I FOREIGN KEY (id, %I) REFERENCES app.%I (%I, id) DEFERRABLE INITIALLY DEFERRED',
      link.source_name, pointer_name, link.pointer_column, link.target_name, link.owner_column);
  END LOOP;
END $$;
--> statement-breakpoint
-- Cross-module references intentionally absent from the module-local Drizzle definitions.
-- Existing single-column FKs are not duplicated.
DO $$ DECLARE link record; target_name text; source_oid oid; target_oid oid; column_number smallint;
BEGIN
  FOR link IN
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'app' AND column_name IN (
      'supporting_reference_id', 'exception_reference_id', 'evidence_reference_id',
      'cause_reference_id', 'audit_event_id', 'logo_media_asset_id',
      'current_photo_media_asset_id', 'home_stage_participant_slot_id',
      'away_stage_participant_slot_id', 'stage_participant_slot_id',
      'source_stage_participant_slot_id', 'ranking_tie_case_id',
      'source_season_entry_id'
    )
  LOOP
    target_name := CASE
      WHEN link.column_name IN ('supporting_reference_id', 'exception_reference_id',
        'evidence_reference_id', 'cause_reference_id') THEN 'supporting_references'
      WHEN link.column_name = 'audit_event_id' THEN 'audit_events'
      WHEN link.column_name IN ('logo_media_asset_id', 'current_photo_media_asset_id') THEN 'media_assets'
      WHEN link.column_name IN ('home_stage_participant_slot_id', 'away_stage_participant_slot_id',
        'stage_participant_slot_id', 'source_stage_participant_slot_id') THEN 'stage_participant_slots'
      WHEN link.column_name = 'ranking_tie_case_id' THEN 'ranking_tie_cases'
      WHEN link.column_name = 'source_season_entry_id' THEN 'season_entries'
    END;
    source_oid := format('app.%I', link.table_name)::regclass;
    target_oid := format('app.%I', target_name)::regclass;
    SELECT attnum INTO column_number FROM pg_attribute
      WHERE attrelid = source_oid AND attname = link.column_name;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conrelid = source_oid AND confrelid = target_oid
        AND contype = 'f' AND conkey = ARRAY[column_number]::smallint[]
    ) THEN
      EXECUTE format('ALTER TABLE app.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES app.%I(id) ON DELETE RESTRICT',
        link.table_name,
        'cross_ref_' || substr(md5(link.table_name || ':' || link.column_name), 1, 16),
        link.column_name, target_name);
    END IF;
  END LOOP;
  ALTER TABLE app.knockout_fixture_slots ADD CONSTRAINT knockout_fixture_slots_tie_fk
    FOREIGN KEY (tie_id) REFERENCES app.knockout_ties(id) ON DELETE RESTRICT;
END $$;
--> statement-breakpoint
CREATE FUNCTION app.reject_immutable_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'immutable history cannot be changed: %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = '55000';
END $$;
--> statement-breakpoint
-- recorded_at is supplied exclusively by immutableRecordColumns().
DO $$ DECLARE relation record;
BEGIN
  FOR relation IN
    SELECT table_schema, table_name FROM information_schema.columns
    WHERE table_schema = 'app' AND column_name = 'recorded_at'
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_change()',
      relation.table_name || '_immutable', relation.table_schema, relation.table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION app.reject_immutable_change()',
      relation.table_name || '_no_truncate', relation.table_schema, relation.table_name);
  END LOOP;
END $$;
--> statement-breakpoint
-- NOLOGIN group roles are assigned to deployment identities outside the migration.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_migrator') THEN
    CREATE ROLE app_migrator NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_public_reader') THEN
    CREATE ROLE app_public_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN
    CREATE ROLE app_worker NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_drift_reader') THEN
    CREATE ROLE app_drift_reader NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
REVOKE ALL ON SCHEMA app FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO app_runtime, app_public_reader, app_worker, app_drift_reader, app_migrator;
--> statement-breakpoint
GRANT CREATE ON SCHEMA app TO app_migrator;
--> statement-breakpoint
-- Runtime is a trusted server role; deletion needs later, resource-specific grants.
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA app TO app_runtime;
--> statement-breakpoint
DO $$ DECLARE relation record;
BEGIN
  FOR relation IN
    SELECT table_schema, table_name FROM information_schema.columns
    WHERE table_schema = 'app' AND column_name = 'recorded_at'
  LOOP
    EXECUTE format('REVOKE UPDATE, DELETE ON %I.%I FROM app_runtime', relation.table_schema, relation.table_name);
  END LOOP;
END $$;
--> statement-breakpoint
-- Worker access is limited to its operational queues and append-only attempt history.
GRANT SELECT, UPDATE ON app.outbox_messages, app.scheduled_jobs,
  app.cache_invalidation_intents, app.inbound_webhook_receipts,
  app.notification_deliveries TO app_worker;
--> statement-breakpoint
GRANT SELECT, INSERT ON app.job_runs TO app_worker;
--> statement-breakpoint
-- No direct table reads for public or drift identities; reviewed views follow with the public query layer.
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM app_public_reader, app_drift_reader;
--> statement-breakpoint
-- The runtime and workers must not be able to forge migration-ledger entries.
REVOKE ALL ON app.__drizzle_migrations FROM app_runtime, app_worker, app_public_reader, app_drift_reader;
--> statement-breakpoint
GRANT SELECT, INSERT ON app.__drizzle_migrations TO app_migrator;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE app.__drizzle_migrations_id_seq TO app_migrator;
