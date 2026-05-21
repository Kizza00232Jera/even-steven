-- =============================================================================
-- Even Steven — Account Deletion Support
-- =============================================================================
-- Adds a server-side function to calculate groups where the current user has
-- a non-zero net balance. Called during the account deletion flow to warn the
-- member before they proceed.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_groups_with_outstanding_balances(p_user_id UUID)
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  -- The caller's active group_member rows
  user_members AS (
    SELECT gm.id AS member_id, gm.group_id
    FROM group_members gm
    WHERE gm.user_id = p_user_id
      AND gm.status  = 'active'
  ),
  -- Total amount paid by the user as payer across all expenses
  amounts_paid AS (
    SELECT e.group_id, SUM(e.amount) AS total
    FROM expenses e
    JOIN user_members um ON e.payer_id = um.member_id
                        AND e.group_id = um.group_id
    GROUP BY e.group_id
  ),
  -- The user's own share in every expense (whether or not they were the payer)
  own_shares AS (
    SELECT e.group_id, SUM(ep.share_amount) AS total
    FROM expense_participants ep
    JOIN expenses e ON ep.expense_id = e.id
    JOIN user_members um ON ep.member_id = um.member_id
                        AND e.group_id   = um.group_id
    GROUP BY e.group_id
  ),
  -- Settlements received by the user
  settlements_received AS (
    SELECT s.group_id, SUM(s.amount) AS total
    FROM settlements s
    JOIN user_members um ON s.payee_member_id = um.member_id
                        AND s.group_id        = um.group_id
    WHERE NOT s.is_voided
    GROUP BY s.group_id
  ),
  -- Settlements paid out by the user
  settlements_paid AS (
    SELECT s.group_id, SUM(s.amount) AS total
    FROM settlements s
    JOIN user_members um ON s.payer_member_id = um.member_id
                        AND s.group_id        = um.group_id
    WHERE NOT s.is_voided
    GROUP BY s.group_id
  ),
  net AS (
    SELECT
      um.group_id,
      COALESCE(ap.total, 0) - COALESCE(os.total, 0)
        + COALESCE(sr.total, 0) - COALESCE(sp.total, 0) AS net_balance
    FROM (SELECT DISTINCT group_id FROM user_members) um
    LEFT JOIN amounts_paid        ap ON ap.group_id = um.group_id
    LEFT JOIN own_shares          os ON os.group_id = um.group_id
    LEFT JOIN settlements_received sr ON sr.group_id = um.group_id
    LEFT JOIN settlements_paid    sp ON sp.group_id = um.group_id
  )
  SELECT g.id, g.name
  FROM groups g
  JOIN net ON net.group_id = g.id
  WHERE ABS(net.net_balance) >= 0.01;
$$;
