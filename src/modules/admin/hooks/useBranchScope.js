// src/modules/admin/hooks/useBranchScope.js
//
// Thin convenience wrapper around AuthContext's branch-detection state
// (see utils/branchDetection.js + AuthContext's loadBranchContext) for the
// admin-module list/detail pages. Every admin page that needs to know
// "am I a group admin, and if so, which branch is the header switcher
// currently narrowed to" pulls it from here rather than reaching into
// useAuth() directly and re-deriving `listParams` inline on every page.
//
// Returned shape:
//   isGroupAdmin          — bool, from AuthContext (branchDetection fallback)
//   branches               — [] for a branch-scoped admin (0 or 1 entries)
//                             or the full branch list for a group admin
//   selectedBranch         — the group admin's current header-switcher
//                             selection (branch_id) or null for "All branches"
//   ownBranch               — branch-scoped admin's own single branch, or
//                             null for a group admin / non-admin
//   branchContextLoading    — true while the boot-time detection probe runs
//   listParams              — { branch: selectedBranch } if a group admin has
//                             narrowed the switcher, else {} — spread this
//                             straight into query params on list endpoints.
//                             Never includes anything for a branch-scoped
//                             admin (the backend ignores/overrides it anyway,
//                             but we don't even send it).
import { useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";

export default function useBranchScope() {
  const {
    isGroupAdmin,
    branches,
    selectedBranch,
    setSelectedBranch,
    ownBranch,
    branchContextLoading,
  } = useAuth();

  const listParams = useMemo(() => {
    if (isGroupAdmin && selectedBranch) return { branch: selectedBranch };
    return {};
  }, [isGroupAdmin, selectedBranch]);

  return {
    isGroupAdmin,
    branches,
    selectedBranch,
    setSelectedBranch,
    ownBranch,
    branchContextLoading,
    listParams,
  };
}