-- Forward-only repair: current participants must be unique within a Stage or Knockout Round.
-- The stored current values are projections of authoritative assignment/tie ownership.
ALTER TABLE app.stage_participant_slots ADD COLUMN current_season_entry_id uuid;
--> statement-breakpoint
ALTER TABLE app.knockout_tie_participant_slots ADD COLUMN round_id uuid;
--> statement-breakpoint
UPDATE app.stage_participant_slots AS slot
SET current_season_entry_id = assignment.season_entry_id
FROM app.stage_participant_assignments AS assignment
WHERE slot.current_assignment_id = assignment.id;
--> statement-breakpoint
UPDATE app.knockout_tie_participant_slots AS slot
SET round_id = tie.round_id
FROM app.knockout_ties AS tie
WHERE slot.tie_id = tie.id;
--> statement-breakpoint
ALTER TABLE app.knockout_tie_participant_slots ALTER COLUMN round_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE app.knockout_ties ADD CONSTRAINT knockout_ties_id_round_uq UNIQUE (id, round_id);
--> statement-breakpoint
ALTER TABLE app.knockout_tie_participant_slots
  ADD CONSTRAINT knockout_tie_participant_slots_tie_round_fk
  FOREIGN KEY (tie_id, round_id) REFERENCES app.knockout_ties (id, round_id);
--> statement-breakpoint
ALTER TABLE app.stage_participant_slots
  ADD CONSTRAINT stage_participant_slots_current_season_entry_id_season_entries_id_fk
  FOREIGN KEY (current_season_entry_id) REFERENCES app.season_entries (id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX stage_participant_slots_current_entry_uq
  ON app.stage_participant_slots (stage_id, current_season_entry_id)
  WHERE current_season_entry_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX knockout_tie_participant_slots_round_entry_uq
  ON app.knockout_tie_participant_slots (round_id, current_season_entry_id)
  WHERE current_season_entry_id IS NOT NULL;
--> statement-breakpoint
CREATE FUNCTION app.sync_stage_slot_current_entry() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE derived_entry uuid;
DECLARE assignment_slot uuid;
BEGIN
  IF NEW.current_assignment_id IS NULL THEN
    NEW.current_season_entry_id := NULL;
    RETURN NEW;
  END IF;

  SELECT assignment.slot_id, assignment.season_entry_id
    INTO assignment_slot, derived_entry
  FROM app.stage_participant_assignments AS assignment
  WHERE assignment.id = NEW.current_assignment_id;

  IF assignment_slot IS NULL OR assignment_slot <> NEW.id THEN
    RAISE EXCEPTION 'Current Stage assignment must belong to this slot'
      USING ERRCODE = '23514', CONSTRAINT = 'stage_participant_slots_current_assignment_owner_ck';
  END IF;
  NEW.current_season_entry_id := derived_entry;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER stage_participant_slots_sync_current_entry
  BEFORE INSERT OR UPDATE OF current_assignment_id, current_season_entry_id, stage_id
  ON app.stage_participant_slots FOR EACH ROW
  EXECUTE FUNCTION app.sync_stage_slot_current_entry();
--> statement-breakpoint
CREATE FUNCTION app.sync_knockout_slot_round() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT tie.round_id INTO NEW.round_id
  FROM app.knockout_ties AS tie WHERE tie.id = NEW.tie_id;
  IF NEW.round_id IS NULL THEN
    RAISE EXCEPTION 'Knockout Tie must exist before a participant slot is created'
      USING ERRCODE = '23503', CONSTRAINT = 'knockout_tie_participant_slots_tie_round_fk';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER knockout_tie_participant_slots_sync_round
  BEFORE INSERT OR UPDATE OF tie_id, round_id
  ON app.knockout_tie_participant_slots FOR EACH ROW
  EXECUTE FUNCTION app.sync_knockout_slot_round();
