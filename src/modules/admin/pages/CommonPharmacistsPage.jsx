// src/modules/admin/pages/CommonPharmacistsPage.jsx
import CommonStaffPage from "./CommonStaffPage";
import {
  getCommonPharmacistList, createCommonPharmacist, patchCommonPharmacist,
  deactivateCommonPharmacist, reactivateCommonPharmacist,
} from "../api/adminApi";

export default function CommonPharmacistsPage() {
  return (
    <CommonStaffPage
      entityLabel="Common Pharmacist"
      entityLabelPlural="Common Pharmacists"
      idField="common_pharmacist_id"
      basePath="/administration/common-pharmacists/"
      api={{
        list:       getCommonPharmacistList,
        create:     createCommonPharmacist,
        patch:      patchCommonPharmacist,
        deactivate: deactivateCommonPharmacist,
        reactivate: reactivateCommonPharmacist,
      }}
    />
  );
}