// src/modules/manager/pages/WebsiteManagementPage.jsx
//
// Hub page for the public-website CMS. Grew past a single row of tabs
// as more resources were added, so this is a two-level nav: top-level
// groups of tabs, grouped by what kind of content they manage, rather
// than one long scrolling row.
import { useState } from "react";
import { Toast, useToast } from "../../../components/shared/Toast";
import DoctorProfilesTab from "./website/DoctorProfilesTab";
import LocationsTab from "./website/LocationsTab";
import SpecialitiesTab from "./website/SpecialitiesTab";
import ProceduresTab from "./website/ProceduresTab";
import ContentSectionsTab from "./website/ContentSectionsTab";
import BlogsTab from "./website/BlogsTab";
import PatientQueriesTab from "./website/PatientQueriesTab";
import TestimonialsTab from "./website/TestimonialsTab";
import YoutubeVideosTab from "./website/YoutubeVideosTab";
import InstagramPostsTab from "./website/InstagramPostsTab";
import FacebookPostsTab from "./website/FacebookPostsTab";
import MediaEventsTab from "./website/MediaEventsTab";
import GalleryTab from "./website/GalleryTab";

// Two groups of 6 — "Clinical Content" is the specialty/doctor/editorial
// side of the site; "Engagement & Media" is patient-facing social proof
// and social-media content. Order within each group is unchanged from
// the old single-row layout.
const GROUPS = [
  {
    key: "content",
    label: "Clinical Content",
    tabs: [
      { key: "doctors",         label: "Doctor Profiles" },
      { key: "locations",       label: "Locations & Contact" },
      { key: "specialities",    label: "Specialities" },
      { key: "procedures",      label: "Diseases & Procedures" },
      { key: "contentSections", label: "Content Sections" },
      { key: "blogs",           label: "Blogs" },
      { key: "mediaEvents",     label: "Media & Events" },
    ],
  },
  {
    key: "engagement",
    label: "Engagement & Media",
    tabs: [
      { key: "queries",      label: "Patient Queries" },
      { key: "testimonials", label: "Testimonials" },
      { key: "youtube",      label: "YouTube Videos" },
      { key: "instagram",    label: "Instagram Posts" },
      { key: "facebook",     label: "Facebook Posts" },
      { key: "gallery",      label: "Gallery" },
    ],
  },
];

export default function WebsiteManagementPage() {
  const [activeGroup, setActiveGroup] = useState(GROUPS[0].key);
  const [activeTab, setActiveTab] = useState(GROUPS[0].tabs[0].key);
  const [toast, showToast] = useToast();

  const currentGroup = GROUPS.find((g) => g.key === activeGroup);

  const selectGroup = (groupKey) => {
    setActiveGroup(groupKey);
    // Switching groups resets to that group's first tab — the previously
    // active tab key likely doesn't exist in the new group at all.
    const group = GROUPS.find((g) => g.key === groupKey);
    setActiveTab(group.tabs[0].key);
  };

  return (
    <div style={{ padding: "24px" }}>
      <Toast toast={toast} />

      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>Website Management</h1>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
          Manage what appears on the public RHIMS website — doctor profiles and availability,
          branch Locations & Contact content, specialities, diseases & procedures, specialty page
          content sections, blog posts, testimonials, YouTube videos, Instagram posts, Facebook
          posts, Media & Events, Gallery images, and incoming Contact-form queries.
        </p>
      </div>

      {/* Top-level group switcher */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        {GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => selectGroup(g.key)}
            style={{
              padding: "10px 20px", borderRadius: "10px", cursor: "pointer",
              fontSize: "13.5px", fontWeight: 700,
              border: activeGroup === g.key ? "1px solid #EA580C" : "1px solid #E2E8F0",
              background: activeGroup === g.key ? "#FFF7ED" : "#fff",
              color: activeGroup === g.key ? "#EA580C" : "#334155",
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Second-level tab row, scoped to the active group */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #E2E8F0", marginBottom: "20px", overflowX: "auto" }}>
        {currentGroup.tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "10px 16px", border: "none", background: "none", cursor: "pointer",
              fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap",
              color: activeTab === t.key ? "#EA580C" : "#64748B",
              borderBottom: activeTab === t.key ? "2px solid #EA580C" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "doctors" && <DoctorProfilesTab showToast={showToast} />}
      {activeTab === "locations" && <LocationsTab showToast={showToast} />}
      {activeTab === "specialities" && <SpecialitiesTab showToast={showToast} />}
      {activeTab === "procedures" && <ProceduresTab showToast={showToast} />}
      {activeTab === "contentSections" && <ContentSectionsTab showToast={showToast} />}
      {activeTab === "blogs" && <BlogsTab showToast={showToast} />}
      {activeTab === "mediaEvents" && <MediaEventsTab showToast={showToast} />}
      {activeTab === "queries" && <PatientQueriesTab showToast={showToast} />}
      {activeTab === "testimonials" && <TestimonialsTab showToast={showToast} />}
      {activeTab === "youtube" && <YoutubeVideosTab showToast={showToast} />}
      {activeTab === "instagram" && <InstagramPostsTab showToast={showToast} />}
      {activeTab === "facebook" && <FacebookPostsTab showToast={showToast} />}
      {activeTab === "gallery" && <GalleryTab showToast={showToast} />}
    </div>
  );
}