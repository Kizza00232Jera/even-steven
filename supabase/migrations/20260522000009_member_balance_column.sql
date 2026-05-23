-- ---------------------------------------------------------------------------
-- Add denormalized balance column to group_members (Option B, issue #16)
-- Maintained by triggers on expenses, expense_participants, settlements
-- ---------------------------------------------------------------------------

ALTER TABLE group_members
  ADD COLUMN balance DECIMAL(12,2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Core recompute function — recalculates balance for all members in a group
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recompute_group_member_balances(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE group_members gm
  SET balance = (
    -- Expense amounts this member paid
    COALESCE((
      SELECT SUM(e.amount) FROM expenses e
      WHERE e.payer_id = gm.id AND e.group_id = p_group_id
    ), 0)
    -- Minus this member's own share across all group expenses
    - COALESCE((
      SELECT SUM(ep.share_amount) FROM expense_participants ep
      JOIN expenses e ON e.id = ep.expense_id
      WHERE ep.member_id = gm.id AND e.group_id = p_group_id
    ), 0)
    -- Settlements where this member was the payer (paid off debt)
    + COALESCE((
      SELECT SUM(s.amount) FROM settlements s
      WHERE s.payer_member_id = gm.id AND s.group_id = p_group_id AND s.is_voided = FALSE
    ), 0)
    -- Settlements where this member was the payee (received payment)
    - COALESCE((
      SELECT SUM(s.amount) FROM settlements s
      WHERE s.payee_member_id = gm.id AND s.group_id = p_group_id AND s.is_voided = FALSE
    ), 0)
  )
  WHERE gm.group_id = p_group_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: expenses
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_recompute_balances_on_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_group_member_balances(OLD.group_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM recompute_group_member_balances(NEW.group_id);
  ELSE
    PERFORM recompute_group_member_balances(OLD.group_id);
    IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
      PERFORM recompute_group_member_balances(NEW.group_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_expenses_balance
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_balances_on_expense();

-- ---------------------------------------------------------------------------
-- Trigger: expense_participants (needs to join expenses to get group_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_recompute_balances_on_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT group_id INTO v_group_id FROM expenses WHERE id = OLD.expense_id;
  ELSE
    SELECT group_id INTO v_group_id FROM expenses WHERE id = NEW.expense_id;
  END IF;
  IF v_group_id IS NOT NULL THEN
    PERFORM recompute_group_member_balances(v_group_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_expense_participants_balance
  AFTER INSERT OR UPDATE OR DELETE ON expense_participants
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_balances_on_participant();

-- ---------------------------------------------------------------------------
-- Trigger: settlements
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_recompute_balances_on_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_group_member_balances(OLD.group_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM recompute_group_member_balances(NEW.group_id);
  ELSE
    PERFORM recompute_group_member_balances(OLD.group_id);
    IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
      PERFORM recompute_group_member_balances(NEW.group_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_settlements_balance
  AFTER INSERT OR UPDATE OR DELETE ON settlements
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_balances_on_settlement();

-- ---------------------------------------------------------------------------
-- Backfill: recompute for any existing groups (safe no-op on empty DB)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT id FROM groups LOOP
    PERFORM recompute_group_member_balances(r.id);
  END LOOP;
END;
$$;
