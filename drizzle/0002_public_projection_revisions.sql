CREATE TABLE "app"."public_projection_revisions" (
	"projection_key" text PRIMARY KEY NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"last_updated_at" timestamp with time zone,
	CONSTRAINT "public_projection_revisions_positive_ck" CHECK ("app"."public_projection_revisions"."revision" > 0)
);
--> statement-breakpoint
-- Bootstrap clocks from existing committed sources, never from migration/render time.
INSERT INTO app.public_projection_revisions (projection_key, last_updated_at)
SELECT 'portal', max(updated_at) FROM app.competitions WHERE visibility = 'public';
--> statement-breakpoint
INSERT INTO app.public_projection_revisions (projection_key, last_updated_at)
SELECT 'competition:' || c.id, greatest(c.updated_at, (SELECT max(s.updated_at) FROM app.seasons s WHERE s.competition_id = c.id AND s.visibility = 'public'))
FROM app.competitions c WHERE c.visibility = 'public';
--> statement-breakpoint
INSERT INTO app.public_projection_revisions (projection_key, last_updated_at)
SELECT 'season:' || s.id, greatest(s.updated_at, c.updated_at,
  (SELECT max(t.updated_at) FROM app.teams t JOIN app.season_entries e ON e.team_id=t.id WHERE e.season_id=s.id AND t.visibility='public'),
  (SELECT max(e.updated_at) FROM app.season_entries e WHERE e.season_id=s.id),
  (SELECT max(st.updated_at) FROM app.competition_stages st WHERE st.season_id=s.id),
  (SELECT max(m.updated_at) FROM app.matches m JOIN app.competition_stages st ON st.id=m.stage_id WHERE st.season_id=s.id AND m.visibility='public'),
  (SELECT max(r.recorded_at) FROM app.match_result_versions r JOIN app.matches m ON m.current_result_version_id=r.id JOIN app.competition_stages st ON st.id=m.stage_id WHERE st.season_id=s.id AND m.visibility='public'),
  (SELECT max(r.recorded_at) FROM app.match_schedule_revisions r JOIN app.matches m ON m.current_schedule_revision_id=r.id JOIN app.competition_stages st ON st.id=m.stage_id WHERE st.season_id=s.id AND m.visibility='public'),
  (SELECT max(a.recorded_at) FROM app.standing_adjustment_decisions a JOIN app.competition_stages st ON st.id=a.stage_id WHERE st.season_id=s.id))
FROM app.seasons s JOIN app.competitions c ON c.id=s.competition_id
WHERE s.visibility='public' AND c.visibility='public';
--> statement-breakpoint
-- Definer functions may update the clock, while readers/runtime cannot forge it.
CREATE FUNCTION app.touch_public_projection(target_key text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  INSERT INTO app.public_projection_revisions(projection_key, revision, last_updated_at)
  VALUES (target_key, 1, clock_timestamp())
  ON CONFLICT (projection_key) DO UPDATE SET
    revision = app.public_projection_revisions.revision + 1,
    last_updated_at = greatest(app.public_projection_revisions.last_updated_at, EXCLUDED.last_updated_at);
$$;
--> statement-breakpoint
CREATE FUNCTION app.track_public_projection_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app AS $$
DECLARE source jsonb; affected uuid; parent uuid; season_ids uuid[] := '{}';
BEGIN
  IF TG_OP='UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN RETURN NEW; END IF;
  FOR source IN SELECT DISTINCT value FROM jsonb_array_elements(
    CASE TG_OP WHEN 'INSERT' THEN jsonb_build_array(to_jsonb(NEW))
      WHEN 'DELETE' THEN jsonb_build_array(to_jsonb(OLD))
      ELSE jsonb_build_array(to_jsonb(OLD),to_jsonb(NEW)) END)
  LOOP
    IF TG_TABLE_NAME='competitions' THEN
      IF source->>'visibility' <> 'public' THEN CONTINUE; END IF;
      affected := (source->>'id')::uuid;
      PERFORM app.touch_public_projection('portal');
      PERFORM app.touch_public_projection('competition:' || affected);
      season_ids := season_ids || ARRAY(SELECT id FROM app.seasons WHERE competition_id=affected AND visibility='public');
    ELSIF TG_TABLE_NAME='seasons' THEN
      IF source->>'visibility' <> 'public' THEN CONTINUE; END IF;
      parent := (source->>'competition_id')::uuid;
      IF NOT EXISTS(SELECT 1 FROM app.competitions WHERE id=parent AND visibility='public') THEN CONTINUE; END IF;
      PERFORM app.touch_public_projection('competition:' || parent);
      season_ids := season_ids || (source->>'id')::uuid;
    ELSIF TG_TABLE_NAME='teams' THEN
      IF source->>'visibility' <> 'public' THEN CONTINUE; END IF;
      season_ids := season_ids || ARRAY(SELECT season_id FROM app.season_entries WHERE team_id=(source->>'id')::uuid);
    ELSIF TG_TABLE_NAME='season_entries' THEN
      season_ids := season_ids || (source->>'season_id')::uuid;
    ELSIF TG_TABLE_NAME IN ('competition_stages','fixture_rounds','stage_participant_slots','standing_adjustment_decisions','matches') THEN
      IF TG_TABLE_NAME='matches' AND source->>'visibility' <> 'public' THEN CONTINUE; END IF;
      IF TG_TABLE_NAME='competition_stages' THEN season_ids := season_ids || (source->>'season_id')::uuid;
      ELSE season_ids := season_ids || ARRAY(SELECT season_id FROM app.competition_stages WHERE id=(source->>'stage_id')::uuid); END IF;
    ELSIF TG_TABLE_NAME='league_fixture_slots' THEN
      season_ids := season_ids || ARRAY(SELECT st.season_id FROM app.fixture_rounds r JOIN app.competition_stages st ON st.id=r.stage_id WHERE r.id=(source->>'fixture_round_id')::uuid);
    ELSIF TG_TABLE_NAME='ranking_rule_sets' THEN
      season_ids := season_ids || ARRAY(SELECT st.season_id FROM app.competition_stages st WHERE st.current_version_id=(source->>'stage_version_id')::uuid);
    ELSIF TG_TABLE_NAME IN ('points_schemes','tie_breakers') THEN
      season_ids := season_ids || ARRAY(SELECT st.season_id FROM app.ranking_rule_sets r JOIN app.competition_stages st ON st.current_version_id=r.stage_version_id WHERE r.id=(source->>'ranking_rule_set_id')::uuid);
    END IF;
  END LOOP;
  FOR affected IN SELECT DISTINCT id FROM unnest(season_ids) AS ids(id) ORDER BY id LOOP
    IF EXISTS(SELECT 1 FROM app.seasons s JOIN app.competitions c ON c.id=s.competition_id WHERE s.id=affected AND s.visibility='public' AND c.visibility='public')
      OR TG_TABLE_NAME='seasons' THEN
      PERFORM app.touch_public_projection('season:' || affected);
    END IF;
  END LOOP;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
DO $$ DECLARE relation text;
BEGIN
  FOREACH relation IN ARRAY ARRAY['competitions','seasons','teams','season_entries','competition_stages','fixture_rounds','league_fixture_slots','matches','stage_participant_slots','ranking_rule_sets','points_schemes','tie_breakers','standing_adjustment_decisions'] LOOP
    EXECUTE format('CREATE TRIGGER track_public_projection AFTER INSERT OR UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.track_public_projection_change()', relation);
  END LOOP;
END $$;
--> statement-breakpoint
REVOKE ALL ON app.public_projection_revisions FROM PUBLIC, app_runtime, app_public_reader, app_worker, app_drift_reader;
--> statement-breakpoint
GRANT SELECT ON app.public_projection_revisions TO app_runtime, app_public_reader;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.touch_public_projection(text), app.track_public_projection_change() FROM PUBLIC;
