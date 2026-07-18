// src/utils/labItemGrouping.js
//
// Shared helpers for "grouped lab tests" (panel billing) — e.g. Liver
// Function Test (LFT) = SGOT + SGPT + Bilirubin + ALP billed once, not once
// per sub-test.
//
// Backend contract (see lab/models.py `calculate_lab_subtotal` /
// lab/serializers.py `LabRequestItemSerializer`):
//   - Each LabRequestItem has an optional `ordered_as_group` FK.
//   - NULL  => standalone test, billed individually at `test_price`.
//   - Set   => this row is one sub-test of a panel. All sibling rows that
//              share the same (lab_request, ordered_as_group) pair count as
//              ONE billable unit at `ordered_as_group_price`.
//
// These helpers let any screen (doctor consultation, lab bill print, walk-in
// review, etc.) cluster sub-test rows under their panel heading and compute
// a subtotal that matches the backend exactly, without re-deriving the
// grouping logic in every component.

/**
 * Groups a flat list of LabRequestItem-like objects into panel rows and
 * standalone rows, preserving first-appearance order.
 *
 * Accepts items shaped like the LabRequestItemSerializer output, e.g.:
 *   { item_id, test, test_name, test_code, test_unit, test_normal_range,
 *     test_price, ordered_as_group, ordered_as_group_name,
 *     ordered_as_group_price, result, ... }
 *
 * Returns an ordered array of rows:
 *   { type: "group", groupId, groupName, groupPrice, items: [item, ...] }
 *   { type: "standalone", item }
 */
export function groupLabRequestItems(items = []) {
  const rows = [];
  const groupRowById = new Map();

  for (const item of items || []) {
    const gid = item.ordered_as_group ?? item.ordered_as_group_id ?? null;

    if (gid != null) {
      let row = groupRowById.get(gid);
      if (!row) {
        const priceRaw = item.ordered_as_group_price;
        row = {
          type: "group",
          groupId: gid,
          groupName: item.ordered_as_group_name || `Panel #${gid}`,
          groupPrice: priceRaw != null && priceRaw !== "" ? parseFloat(priceRaw) : null,
          items: [],
        };
        groupRowById.set(gid, row);
        rows.push(row);
      }
      row.items.push(item);
    } else {
      rows.push({ type: "standalone", item });
    }
  }

  return rows;
}

/**
 * Given the currently-selected TestGroup objects (each with a `sub_tests`
 * array of { test_id, ... }), returns a Set of test_ids that are already
 * covered by a selected panel.
 *
 * Used by test-picker UIs to grey out / block individually selecting a
 * sub-test that's already billed as part of a selected panel — the backend's
 * unique_together on (lab_request, test) would reject the duplicate anyway,
 * but the picker should guide the user away from it in the first place.
 */
export function subTestIdsCoveredByGroups(selectedGroups = []) {
  const ids = new Set();
  for (const g of selectedGroups || []) {
    for (const st of g?.sub_tests || []) {
      const tid = st.test_id ?? st.id;
      if (tid != null) ids.add(tid);
    }
  }
  return ids;
}

/**
 * Client-side mirror of the backend's calculate_lab_subtotal(): a panel is
 * billed once no matter how many sub-test rows it produced; standalone
 * items are billed individually at their own price. Useful for showing a
 * running total before the request/bill is actually created server-side.
 */
export function calculateLabSubtotalClientSide(items = []) {
  const rows = groupLabRequestItems(items);
  let subtotal = 0;
  for (const row of rows) {
    if (row.type === "group") {
      subtotal += row.groupPrice ?? 0;
    } else {
      subtotal += parseFloat(row.item?.test_price ?? 0) || 0;
    }
  }
  return subtotal;
}
