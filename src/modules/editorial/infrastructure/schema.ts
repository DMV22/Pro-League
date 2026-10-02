import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

import { competitions, seasons } from '../../competition/infrastructure/schema'
import { matches } from '../../match/infrastructure/schema'
import { mediaAssets, mediaPresentations } from '../../media/infrastructure/schema'
import { players, teams } from '../../registration/infrastructure/schema'
import { immutableRecordColumns, mutableRecordColumns } from '../../../server/db/columns'
import { appSchema } from '../../../server/db/schema'

// Structured, schema-versioned content is rendered after validation; arbitrary HTML is never stored.
export const newsArticles = appSchema.table(
  'news_articles',
  {
    ...mutableRecordColumns(),
    lifecycleState: text('lifecycle_state').notNull().default('draft'),
    firstPublishedAt: timestamp('first_published_at', { withTimezone: true }),
    originalPublishedAt: timestamp('original_published_at', { withTimezone: true }),
    currentWorkingCopyId: uuid('current_working_copy_id').references(
      (): AnyPgColumn => articleWorkingCopies.id,
    ),
    currentPublishedRevisionId: uuid('current_published_revision_id').references(
      (): AnyPgColumn => articleRevisions.id,
    ),
    currentSlugId: uuid('current_slug_id').references((): AnyPgColumn => articleSlugs.id),
    authorId: uuid('author_id').notNull(),
  },
  (table) => [
    check(
      'news_articles_state_ck',
      sql`${table.lifecycleState} in ('draft', 'scheduled', 'published', 'archived')`,
    ),
    check(
      'news_articles_publication_ck',
      sql`${table.currentPublishedRevisionId} is null or ${table.firstPublishedAt} is not null`,
    ),
    index('news_articles_state_published_idx').on(table.lifecycleState, table.firstPublishedAt),
  ],
)

export const articleSlugs = appSchema.table(
  'article_slugs',
  {
    ...immutableRecordColumns(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => newsArticles.id),
    displaySlug: text('display_slug').notNull(),
    normalizedSlug: text('normalized_slug').notNull(),
    validFromAt: timestamp('valid_from_at', { withTimezone: true }).notNull(),
    replacedBySlugId: uuid('replaced_by_slug_id').references((): AnyPgColumn => articleSlugs.id),
  },
  (table) => [
    uniqueIndex('article_slugs_normalized_uq').on(table.normalizedSlug),
    unique('article_slugs_owner_id_uq').on(table.articleId, table.id),
  ],
)

export const articleCategories = appSchema.table(
  'article_categories',
  {
    ...mutableRecordColumns(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    normalizedSlug: text('normalized_slug').notNull(),
    archiveState: text('archive_state').notNull().default('active'),
    currentVersionId: uuid('current_version_id').references(
      (): AnyPgColumn => articleCategoryVersions.id,
    ),
  },
  (table) => [
    uniqueIndex('article_categories_normalized_slug_uq').on(table.normalizedSlug),
    check('article_categories_archive_ck', sql`${table.archiveState} in ('active', 'archived')`),
  ],
)

export const articleCategoryVersions = appSchema.table('article_category_versions', {
  ...immutableRecordColumns(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => articleCategories.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  reason: text('reason'),
  actorId: uuid('actor_id').notNull(),
  supersedesVersionId: uuid('supersedes_version_id').references(
    (): AnyPgColumn => articleCategoryVersions.id,
  ),
})

export const articleCategoryStateTransitions = appSchema.table(
  'article_category_state_transitions',
  {
    ...immutableRecordColumns(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => articleCategories.id),
    fromState: text('from_state').notNull(),
    toState: text('to_state').notNull(),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
  },
)

export const articleWorkingCopies = appSchema.table(
  'article_working_copies',
  {
    ...mutableRecordColumns(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => newsArticles.id),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    body: jsonb('body').notNull(),
    contentSchemaVersion: integer('content_schema_version').notNull(),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => articleCategories.id),
    proposedSlug: text('proposed_slug').notNull(),
    validationState: text('validation_state').notNull().default('incomplete'),
    recoveryVersion: bigint('recovery_version', { mode: 'bigint' }).notNull().default(1n),
  },
  (table) => [
    check('article_working_copies_schema_ck', sql`${table.contentSchemaVersion} > 0`),
    check('article_working_copies_recovery_ck', sql`${table.recoveryVersion} > 0`),
    check(
      'article_working_copies_validation_ck',
      sql`${table.validationState} in ('incomplete', 'valid', 'invalid')`,
    ),
  ],
)

export const articleRevisions = appSchema.table(
  'article_revisions',
  {
    ...immutableRecordColumns(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => newsArticles.id),
    slugId: uuid('slug_id')
      .notNull()
      .references(() => articleSlugs.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => articleCategories.id),
    categoryNameSnapshot: text('category_name_snapshot').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    body: jsonb('body').notNull(),
    contentSchemaVersion: integer('content_schema_version').notNull(),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    contentHash: text('content_hash').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    authorId: uuid('author_id').notNull(),
    internalReason: text('internal_reason'),
    publicCorrectionExplanation: text('public_correction_explanation'),
    supersedesRevisionId: uuid('supersedes_revision_id').references(
      (): AnyPgColumn => articleRevisions.id,
    ),
  },
  (table) => [
    unique('article_revisions_owner_id_uq').on(table.articleId, table.id),
    check('article_revisions_schema_ck', sql`${table.contentSchemaVersion} > 0`),
  ],
)

export const articleStateTransitions = appSchema.table('article_state_transitions', {
  ...immutableRecordColumns(),
  articleId: uuid('article_id')
    .notNull()
    .references(() => newsArticles.id),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  publicationScheduleId: uuid('publication_schedule_id').references(
    (): AnyPgColumn => articlePublicationSchedules.id,
  ),
  publishedRevisionId: uuid('published_revision_id').references(() => articleRevisions.id),
  reason: text('reason'),
  actorId: uuid('actor_id'),
})

// Typed links avoid a polymorphic FK and never arise from textual mentions alone.
export const articleCompetitionAssociationsWorking = appSchema.table(
  'article_competition_associations_working',
  {
    ...mutableRecordColumns(),
    workingCopyId: uuid('working_copy_id')
      .notNull()
      .references(() => articleWorkingCopies.id),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'restrict' }),
  },
  (table) => [
    unique('article_competition_working_uq').on(table.workingCopyId, table.competitionId),
  ],
)
export const articleSeasonAssociationsWorking = appSchema.table(
  'article_season_associations_working',
  {
    ...mutableRecordColumns(),
    workingCopyId: uuid('working_copy_id')
      .notNull()
      .references(() => articleWorkingCopies.id),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
  },
  (table) => [unique('article_season_working_uq').on(table.workingCopyId, table.seasonId)],
)
export const articleTeamAssociationsWorking = appSchema.table(
  'article_team_associations_working',
  {
    ...mutableRecordColumns(),
    workingCopyId: uuid('working_copy_id')
      .notNull()
      .references(() => articleWorkingCopies.id),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
  },
  (table) => [unique('article_team_working_uq').on(table.workingCopyId, table.teamId)],
)
export const articleMatchAssociationsWorking = appSchema.table(
  'article_match_associations_working',
  {
    ...mutableRecordColumns(),
    workingCopyId: uuid('working_copy_id')
      .notNull()
      .references(() => articleWorkingCopies.id),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'restrict' }),
  },
  (table) => [unique('article_match_working_uq').on(table.workingCopyId, table.matchId)],
)
export const articlePlayerAssociationsWorking = appSchema.table(
  'article_player_associations_working',
  {
    ...mutableRecordColumns(),
    workingCopyId: uuid('working_copy_id')
      .notNull()
      .references(() => articleWorkingCopies.id),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
  },
  (table) => [unique('article_player_working_uq').on(table.workingCopyId, table.playerId)],
)

export const articleCompetitionAssociationsRevision = appSchema.table(
  'article_competition_associations_revision',
  {
    ...immutableRecordColumns(),
    revisionId: uuid('revision_id')
      .notNull()
      .references(() => articleRevisions.id),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'restrict' }),
  },
  (table) => [unique('article_competition_revision_uq').on(table.revisionId, table.competitionId)],
)
export const articleSeasonAssociationsRevision = appSchema.table(
  'article_season_associations_revision',
  {
    ...immutableRecordColumns(),
    revisionId: uuid('revision_id')
      .notNull()
      .references(() => articleRevisions.id),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
  },
  (table) => [unique('article_season_revision_uq').on(table.revisionId, table.seasonId)],
)
export const articleTeamAssociationsRevision = appSchema.table(
  'article_team_associations_revision',
  {
    ...immutableRecordColumns(),
    revisionId: uuid('revision_id')
      .notNull()
      .references(() => articleRevisions.id),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
  },
  (table) => [unique('article_team_revision_uq').on(table.revisionId, table.teamId)],
)
export const articleMatchAssociationsRevision = appSchema.table(
  'article_match_associations_revision',
  {
    ...immutableRecordColumns(),
    revisionId: uuid('revision_id')
      .notNull()
      .references(() => articleRevisions.id),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'restrict' }),
  },
  (table) => [unique('article_match_revision_uq').on(table.revisionId, table.matchId)],
)
export const articlePlayerAssociationsRevision = appSchema.table(
  'article_player_associations_revision',
  {
    ...immutableRecordColumns(),
    revisionId: uuid('revision_id')
      .notNull()
      .references(() => articleRevisions.id),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
  },
  (table) => [unique('article_player_revision_uq').on(table.revisionId, table.playerId)],
)

export const articlePublicationSchedules = appSchema.table(
  'article_publication_schedules',
  {
    ...mutableRecordColumns(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => newsArticles.id),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    workingCopyId: uuid('working_copy_id')
      .notNull()
      .references(() => articleWorkingCopies.id),
    expectedWorkingVersion: bigint('expected_working_version', { mode: 'bigint' }).notNull(),
    state: text('state').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastFailureReason: text('last_failure_reason'),
  },
  (table) => [
    index('article_publication_schedules_due_idx').on(table.state, table.dueAt),
    check(
      'article_publication_schedules_state_ck',
      sql`${table.state} in ('pending', 'processing', 'published', 'failed', 'cancelled')`,
    ),
    check('article_publication_schedules_attempts_ck', sql`${table.attemptCount} >= 0`),
  ],
)

export const articleRecoverySnapshots = appSchema.table('article_recovery_snapshots', {
  ...immutableRecordColumns(),
  workingCopyId: uuid('working_copy_id')
    .notNull()
    .references(() => articleWorkingCopies.id),
  workingVersion: bigint('working_version', { mode: 'bigint' }).notNull(),
  body: jsonb('body').notNull(),
  contentSchemaVersion: integer('content_schema_version').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const featuredArticleDecisions = appSchema.table(
  'featured_article_decisions',
  {
    ...immutableRecordColumns(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => newsArticles.id),
    decision: text('decision').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    reason: text('reason'),
    actorId: uuid('actor_id').notNull(),
    supersedesDecisionId: uuid('supersedes_decision_id').references(
      (): AnyPgColumn => featuredArticleDecisions.id,
    ),
  },
  (table) => [
    check('featured_article_decisions_type_ck', sql`${table.decision} in ('feature', 'unfeature')`),
    check(
      'featured_article_decisions_period_ck',
      sql`${table.endsAt} is null or ${table.endsAt} > ${table.startsAt}`,
    ),
  ],
)

export const articleMediaPlacementsWorking = appSchema.table(
  'article_media_placements_working',
  {
    ...mutableRecordColumns(),
    workingCopyId: uuid('working_copy_id')
      .notNull()
      .references(() => articleWorkingCopies.id),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    presentationId: uuid('presentation_id')
      .notNull()
      .references(() => mediaPresentations.id, { onDelete: 'restrict' }),
    role: text('role').notNull(),
    position: integer('position').notNull(),
    altText: text('alt_text'),
    caption: text('caption'),
    decorative: boolean('decorative').notNull().default(false),
  },
  (table) => [
    unique('article_media_placements_working_position_uq').on(
      table.workingCopyId,
      table.role,
      table.position,
    ),
    check('article_media_placements_working_role_ck', sql`${table.role} in ('cover', 'inline')`),
    check('article_media_placements_working_position_ck', sql`${table.position} > 0`),
  ],
)

export const articleMediaPlacementsRevision = appSchema.table(
  'article_media_placements_revision',
  {
    ...immutableRecordColumns(),
    revisionId: uuid('revision_id')
      .notNull()
      .references(() => articleRevisions.id),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    presentationId: uuid('presentation_id')
      .notNull()
      .references(() => mediaPresentations.id, { onDelete: 'restrict' }),
    role: text('role').notNull(),
    position: integer('position').notNull(),
    altText: text('alt_text'),
    caption: text('caption'),
    decorative: boolean('decorative').notNull(),
    attributionSnapshot: text('attribution_snapshot'),
  },
  (table) => [
    unique('article_media_placements_revision_position_uq').on(
      table.revisionId,
      table.role,
      table.position,
    ),
    check('article_media_placements_revision_position_ck', sql`${table.position} > 0`),
    check(
      'article_media_placements_revision_alt_ck',
      sql`${table.decorative} or nullif(btrim(${table.altText}), '') is not null`,
    ),
  ],
)
