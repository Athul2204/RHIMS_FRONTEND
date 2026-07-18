// src/modules/admin/pages/CommonReceptionistsPage.jsx
import CommonStaffPage from "./CommonStaffPage";
import {
  getCommonReceptionistList, createCommonReceptionist, patchCommonReceptionist,
  deactivateCommonReceptionist, reactivateCommonReceptionist,
} from "../api/adminApi";

export default function CommonReceptionistsPage() {
  return (
    <CommonStaffPage
      entityLabel="Common Receptionist"
      entityLabelPlural="Common Receptionists"
      idField="common_receptionist_id"
      basePath="/administration/common-receptionists/"
      api={{
        list:       getCommonReceptionistList,
        create:     createCommonReceptionist,
        patch:      patchCommonReceptionist,
        deactivate: deactivateCommonReceptionist,
        reactivate: reactivateCommonReceptionist,
      }}
    />
  );
}