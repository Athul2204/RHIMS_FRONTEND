// src/modules/manager/api/websiteApi.js
//
// Manager-side "Website Management" CMS — talks to the authenticated
// /api/manager/website/... endpoints (IsAdminOrManager, JWT via the
// existing httpOnly-cookie auth already wired into ../../../api).
//
// Covers seven resources: doctor website profiles (+ nested weekly
// availability + date exceptions), patient queries (public Contact-form
// inbox), testimonials, YouTube videos, and Instagram posts.
import API from "../../../api";

// ═══════════════════════════════════════════════════════
// Media URL helper
// ═══════════════════════════════════════════════════════
//
// The PUBLIC endpoints (api/public/...) return absolute photo/image URLs
// already. These MANAGER endpoints don't (plain ImageField serialization
// with no request context) — they return a relative path like
// "/media/website/doctors/1/photo.jpg". Prefix it with the API's origin
// (protocol + host, no /api suffix) before rendering an <img>.
function resolveApiOrigin() {
  const raw = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").trim();
  try {
    const withoutApiSuffix = raw.replace(/\/+$/, "").replace(/\/api$/, "");
    const u = new URL(withoutApiSuffix);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:8000";
  }
}

export function toAbsoluteMediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path; // already absolute — leave as-is
  return `${resolveApiOrigin()}${path}`;
}

// Build a multipart FormData body from a plain object. File values (a
// browser File/Blob) are appended as files; arrays/plain objects are
// JSON-encoded (the backend's FlexibleJSONField parses a JSON string back
// into a list/object — multipart form fields can't carry nested structures
// natively, and JS's default String(arr) would silently comma-join instead
// of producing valid JSON); everything else (including booleans/numbers)
// is stringified — DRF's fields all accept string representations over
// multipart. null/undefined values are skipped so "leave unchanged on
// edit" works without sending empty strings that would clear the field.
function toFormData(payload) {
  const fd = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (value instanceof File) {
      fd.append(key, value);
    } else if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
      fd.append(key, JSON.stringify(value));
    } else {
      fd.append(key, String(value));
    }
  });
  return fd;
}

const MULTIPART_HEADERS = { headers: { "Content-Type": "multipart/form-data" } };

// ═══════════════════════════════════════════════════════
// EMR DOCTOR PICKER (for "which doctor" dropdowns)
// ═══════════════════════════════════════════════════════
//
// Deliberately NOT /api/administration/doctors/ — that endpoint is
// Admin-only (AdminOnlyView) and 403s for a Manager-role login, which is
// exactly why the doctor picker was showing empty before. This hits the
// manager-scoped read-only endpoint instead.
export const getEmrDoctorList = async (params = {}) => {
  const res = await API.get("/manager/website/emr-doctors/", { params });
  return res.data;
};

// ═══════════════════════════════════════════════════════
// DOCTOR WEBSITE PROFILES
// ═══════════════════════════════════════════════════════

export const getWebsiteDoctorList = async () => {
  const res = await API.get("/manager/website/doctors/");
  return res.data;
};

// payload: { doctor, is_published, bio, display_order, photo? (File) }
export const createWebsiteDoctor = async (payload) => {
  const res = await API.post("/manager/website/doctors/", toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const updateWebsiteDoctor = async (id, payload) => {
  const res = await API.patch(`/manager/website/doctors/${id}/`, toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const deleteWebsiteDoctor = async (id) => {
  const res = await API.delete(`/manager/website/doctors/${id}/`);
  return res.data;
};

// Find an existing website profile that already covers this real-world
// doctor (by registration number, the cross-branch key — or by name as a
// fallback) before creating a new one. Used by the "Add Doctor to
// Website" flow to offer "attach this branch" instead of spinning up a
// duplicate profile when the doctor's other branch is already published.
export const searchWebsiteDoctor = async (params) => {
  const res = await API.get("/manager/website/doctors/search/", { params });
  return res.data;
};

// Attach another branch's DoctorProfile to an existing, already-shared
// website profile — the "no duplication" path for a doctor's 2nd+ branch.
export const attachBranchToWebsiteDoctor = async (profileId, doctorId) => {
  const res = await API.post(`/manager/website/doctors/${profileId}/attach-branch/`, { doctor: doctorId });
  return res.data;
};

// Detach one branch from a shared website profile (e.g. the doctor
// stopped practicing at that location). Refused server-side if it's the
// last remaining branch — delete the whole profile instead in that case.
export const detachBranchFromWebsiteDoctor = async (profileId, doctorId) => {
  const res = await API.delete(`/manager/website/doctors/${profileId}/attach-branch/`, { data: { doctor: doctorId } });
  return res.data;
};

// ── Weekly availability (nested per doctor) ──
export const getWeeklyAvailability = async (doctorId) => {
  const res = await API.get(`/manager/website/doctors/${doctorId}/weekly-availability/`);
  return res.data;
};

export const createWeeklyAvailability = async (doctorId, payload) => {
  const res = await API.post(`/manager/website/doctors/${doctorId}/weekly-availability/`, payload);
  return res.data;
};

export const updateWeeklyAvailability = async (doctorId, id, payload) => {
  const res = await API.patch(`/manager/website/doctors/${doctorId}/weekly-availability/${id}/`, payload);
  return res.data;
};

export const deleteWeeklyAvailability = async (doctorId, id) => {
  const res = await API.delete(`/manager/website/doctors/${doctorId}/weekly-availability/${id}/`);
  return res.data;
};

// ── Date-specific availability exceptions (nested per doctor) ──
export const getAvailabilityExceptions = async (doctorId) => {
  const res = await API.get(`/manager/website/doctors/${doctorId}/availability-exceptions/`);
  return res.data;
};

export const createAvailabilityException = async (doctorId, payload) => {
  const res = await API.post(`/manager/website/doctors/${doctorId}/availability-exceptions/`, payload);
  return res.data;
};

export const updateAvailabilityException = async (doctorId, id, payload) => {
  const res = await API.patch(`/manager/website/doctors/${doctorId}/availability-exceptions/${id}/`, payload);
  return res.data;
};

export const deleteAvailabilityException = async (doctorId, id) => {
  const res = await API.delete(`/manager/website/doctors/${doctorId}/availability-exceptions/${id}/`);
  return res.data;
};

// ═══════════════════════════════════════════════════════
// LOCATIONS & CONTACT (per-branch public content)
// ═══════════════════════════════════════════════════════
//
// Keyed by Branch, not by a separate "create a branch" flow — branches
// themselves are created/edited (name/code/address/phone) from Admin >
// Branches. This is only the public-content layer (description,
// highlights, hours, map link, photo, published state) shown on the
// website's Locations and Contact pages. getWebsiteBranches() always
// returns every branch the caller manages, even ones with no content
// yet (has_profile: false) — see ManagerBranchWebsiteSerializer.

export const getWebsiteBranches = async () => {
  const res = await API.get("/manager/website/branches/");
  return res.data;
};

// payload: { is_published?, description?, highlights? (string[]), email?,
// hours_text?, map_url?, photo? (File), remove_photo?, display_order? }
// Upsert — the first call for a branch with no content yet creates it.
export const updateWebsiteBranch = async (branchId, payload) => {
  const res = await API.patch(`/manager/website/branches/${branchId}/`, toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

// ═══════════════════════════════════════════════════════
// PATIENT QUERIES (public Contact-form inbox — read + status only)
// ═══════════════════════════════════════════════════════

export const getPatientQueries = async (params = {}) => {
  const res = await API.get("/manager/website/queries/", { params });
  return res.data;
};

export const updatePatientQueryStatus = async (id, status) => {
  const res = await API.patch(`/manager/website/queries/${id}/`, { status });
  return res.data;
};

// ═══════════════════════════════════════════════════════
// TESTIMONIALS
// ═══════════════════════════════════════════════════════

// params: { search, ordering, page, page_size } -> { count, page, page_size, results }
export const getTestimonials = async (params = {}) => {
  const res = await API.get("/manager/website/testimonials/", { params });
  return res.data;
};

export const createTestimonial = async (payload) => {
  const res = await API.post("/manager/website/testimonials/", toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const updateTestimonial = async (id, payload) => {
  const res = await API.patch(`/manager/website/testimonials/${id}/`, toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const deleteTestimonial = async (id) => {
  const res = await API.delete(`/manager/website/testimonials/${id}/`);
  return res.data;
};

export const activateTestimonial = async (id) => {
  const res = await API.post(`/manager/website/testimonials/${id}/activate/`);
  return res.data;
};

export const deactivateTestimonial = async (id) => {
  const res = await API.post(`/manager/website/testimonials/${id}/deactivate/`);
  return res.data;
};

export const reorderTestimonials = async (orderedIds) => {
  const res = await API.post("/manager/website/testimonials/reorder/", { order: orderedIds });
  return res.data;
};

// No dedicated feature/unfeature endpoint exists (unlike activate/
// deactivate) — the prompt spec calls for PATCHing is_featured directly.
// Plain JSON PATCH (not multipart) since no file is involved.
export const setTestimonialFeatured = async (id, isFeatured) => {
  const res = await API.patch(`/manager/website/testimonials/${id}/`, { is_featured: isFeatured });
  return res.data;
};

// ═══════════════════════════════════════════════════════
// YOUTUBE VIDEOS
// ═══════════════════════════════════════════════════════

export const getYoutubeVideos = async (params = {}) => {
  const res = await API.get("/manager/website/youtube-videos/", { params });
  return res.data;
};

// payload: { youtube_url, title?, description?, doctor? }
export const createYoutubeVideo = async (payload) => {
  const res = await API.post("/manager/website/youtube-videos/", payload);
  return res.data;
};

export const updateYoutubeVideo = async (id, payload) => {
  const res = await API.patch(`/manager/website/youtube-videos/${id}/`, payload);
  return res.data;
};

export const deleteYoutubeVideo = async (id) => {
  const res = await API.delete(`/manager/website/youtube-videos/${id}/`);
  return res.data;
};

export const activateYoutubeVideo = async (id) => {
  const res = await API.post(`/manager/website/youtube-videos/${id}/activate/`);
  return res.data;
};

export const deactivateYoutubeVideo = async (id) => {
  const res = await API.post(`/manager/website/youtube-videos/${id}/deactivate/`);
  return res.data;
};

export const reorderYoutubeVideos = async (orderedIds) => {
  const res = await API.post("/manager/website/youtube-videos/reorder/", { order: orderedIds });
  return res.data;
};

export const setYoutubeVideoFeatured = async (id, isFeatured) => {
  const res = await API.patch(`/manager/website/youtube-videos/${id}/`, { is_featured: isFeatured });
  return res.data;
};

// ═══════════════════════════════════════════════════════
// SPECIALITIES
// ═══════════════════════════════════════════════════════
//
// GET is NOT paginated (plain array). By default only top-level
// specialties come back (parent__isnull=True) — pass { all: true } to
// get every specialty flat (used by getSpecialityOptions below, and by
// SpecialitiesTab to build its own two-level tree client-side).
// Speciality has a `hero_image` file field, so create/update go through
// toFormData()/multipart the same way testimonials do for `photo`.

export const getSpecialities = async (params = {}) => {
  const res = await API.get("/manager/website/specialities/", { params });
  return res.data;
};

export const createSpeciality = async (payload) => {
  const res = await API.post("/manager/website/specialities/", toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const updateSpeciality = async (id, payload) => {
  const res = await API.patch(`/manager/website/specialities/${id}/`, toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const deleteSpeciality = async (id) => {
  const res = await API.delete(`/manager/website/specialities/${id}/`);
  return res.data;
};

export const activateSpeciality = async (id) => {
  const res = await API.post(`/manager/website/specialities/${id}/activate/`);
  return res.data;
};

export const deactivateSpeciality = async (id) => {
  const res = await API.post(`/manager/website/specialities/${id}/deactivate/`);
  return res.data;
};

export const reorderSpecialities = async (orderedIds) => {
  const res = await API.post("/manager/website/specialities/reorder/", { order: orderedIds });
  return res.data;
};

// Thin wrapper used to populate the specialty <select> everywhere it's
// needed (Procedure/Blog forms here, and DoctorProfilesTab.jsx /
// DoctorsPage.jsx elsewhere) — one shared source of truth rather than
// three ad-hoc fetches.
export const getSpecialityOptions = async () => {
  const res = await API.get("/manager/website/specialities/", { params: { all: true } });
  return res.data;
};

// ═══════════════════════════════════════════════════════
// DISEASES & PROCEDURES
// ═══════════════════════════════════════════════════════
//
// GET is NOT paginated (plain array) and genuinely supports
// ?specialty=<id> server-side. Procedure now has a `hero_image` file
// field and a `sections` JSON field (the detail-page body, same shape
// as SpecialtySection.subsections), so create/update go through
// toFormData()/multipart like Speciality/Blog do — `sections` gets
// JSON.stringify'd and parsed back server-side by FlexibleJSONField.

// ⚠️ FIX: the backend view docstrings (WebsiteTreatmentListView etc. in
// manager/views.py) claim this lives at .../website/procedures/, but
// manager/urls.py actually registers it at .../website/treatments/ — the
// docstrings are stale. Calling the documented-but-wrong /procedures/
// path 404'd on every load ("failed to load the procedures or
// treatments"). Using the real registered path here.
export const getProcedures = async (params = {}) => {
  const res = await API.get("/manager/website/treatments/", { params });
  return res.data;
};

export const createProcedure = async (payload) => {
  const res = await API.post("/manager/website/treatments/", toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const updateProcedure = async (id, payload) => {
  const res = await API.patch(`/manager/website/treatments/${id}/`, toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const deleteProcedure = async (id) => {
  const res = await API.delete(`/manager/website/treatments/${id}/`);
  return res.data;
};

export const activateProcedure = async (id) => {
  const res = await API.post(`/manager/website/treatments/${id}/activate/`);
  return res.data;
};

export const deactivateProcedure = async (id) => {
  const res = await API.post(`/manager/website/treatments/${id}/deactivate/`);
  return res.data;
};

export const reorderProcedures = async (orderedIds) => {
  const res = await API.post("/manager/website/treatments/reorder/", { order: orderedIds });
  return res.data;
};

// ═══════════════════════════════════════════════════════
// SPECIALTY CONTENT SECTIONS ("Why Choose Us?", "Treatments and
// Procedures", "Available Facilities and Equipment", etc.)
// ═══════════════════════════════════════════════════════
//
// Always scoped to one specialty — GET requires ?specialty=<id>. No file
// field, so plain JSON like Procedures. `items` is a single newline-
// separated string here (one bullet per line) — the public site splits
// it into a list server-side.

export const getSpecialtySections = async (specialtyId) => {
  const res = await API.get("/manager/website/specialty-sections/", { params: { specialty: specialtyId } });
  return res.data;
};

export const createSpecialtySection = async (payload) => {
  const res = await API.post("/manager/website/specialty-sections/", payload);
  return res.data;
};

export const updateSpecialtySection = async (id, payload) => {
  const res = await API.patch(`/manager/website/specialty-sections/${id}/`, payload);
  return res.data;
};

export const deleteSpecialtySection = async (id) => {
  const res = await API.delete(`/manager/website/specialty-sections/${id}/`);
  return res.data;
};

export const reorderSpecialtySections = async (orderedIds) => {
  const res = await API.post("/manager/website/specialty-sections/reorder/", { order: orderedIds });
  return res.data;
};

// ═══════════════════════════════════════════════════════
// BLOGS
// ═══════════════════════════════════════════════════════
//
// GET IS paginated ({ count, page, page_size, results }), same shape as
// testimonials/youtube-videos/instagram-posts. Blog has a `cover_image`
// file field, so create/update go through toFormData()/multipart.

export const getBlogs = async (params = {}) => {
  const res = await API.get("/manager/website/blogs/", { params });
  return res.data;
};

export const createBlog = async (payload) => {
  const res = await API.post("/manager/website/blogs/", toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const updateBlog = async (id, payload) => {
  const res = await API.patch(`/manager/website/blogs/${id}/`, toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const deleteBlog = async (id) => {
  const res = await API.delete(`/manager/website/blogs/${id}/`);
  return res.data;
};

export const activateBlog = async (id) => {
  const res = await API.post(`/manager/website/blogs/${id}/activate/`);
  return res.data;
};

export const deactivateBlog = async (id) => {
  const res = await API.post(`/manager/website/blogs/${id}/deactivate/`);
  return res.data;
};

export const reorderBlogs = async (orderedIds) => {
  const res = await API.post("/manager/website/blogs/reorder/", { order: orderedIds });
  return res.data;
};

// ═══════════════════════════════════════════════════════
// INSTAGRAM POSTS
// ═══════════════════════════════════════════════════════

export const getInstagramPosts = async (params = {}) => {
  const res = await API.get("/manager/website/instagram-posts/", { params });
  return res.data;
};

// payload: { instagram_url, caption?, thumbnail? (File), remove_thumbnail? }
export const createInstagramPost = async (payload) => {
  const res = await API.post("/manager/website/instagram-posts/", toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const updateInstagramPost = async (id, payload) => {
  const res = await API.patch(`/manager/website/instagram-posts/${id}/`, toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const deleteInstagramPost = async (id) => {
  const res = await API.delete(`/manager/website/instagram-posts/${id}/`);
  return res.data;
};

export const activateInstagramPost = async (id) => {
  const res = await API.post(`/manager/website/instagram-posts/${id}/activate/`);
  return res.data;
};

export const deactivateInstagramPost = async (id) => {
  const res = await API.post(`/manager/website/instagram-posts/${id}/deactivate/`);
  return res.data;
};

export const reorderInstagramPosts = async (orderedIds) => {
  const res = await API.post("/manager/website/instagram-posts/reorder/", { order: orderedIds });
  return res.data;
};

export const setInstagramPostFeatured = async (id, isFeatured) => {
  const res = await API.patch(`/manager/website/instagram-posts/${id}/`, { is_featured: isFeatured });
  return res.data;
};

// ═══════════════════════════════════════════════════════
// FACEBOOK POSTS
// ═══════════════════════════════════════════════════════

export const getFacebookPosts = async (params = {}) => {
  const res = await API.get("/manager/website/facebook-posts/", { params });
  return res.data;
};

// payload: { facebook_url, caption?, thumbnail? (File), remove_thumbnail? }
export const createFacebookPost = async (payload) => {
  const res = await API.post("/manager/website/facebook-posts/", toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const updateFacebookPost = async (id, payload) => {
  const res = await API.patch(`/manager/website/facebook-posts/${id}/`, toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const deleteFacebookPost = async (id) => {
  const res = await API.delete(`/manager/website/facebook-posts/${id}/`);
  return res.data;
};

export const activateFacebookPost = async (id) => {
  const res = await API.post(`/manager/website/facebook-posts/${id}/activate/`);
  return res.data;
};

export const deactivateFacebookPost = async (id) => {
  const res = await API.post(`/manager/website/facebook-posts/${id}/deactivate/`);
  return res.data;
};

export const reorderFacebookPosts = async (orderedIds) => {
  const res = await API.post("/manager/website/facebook-posts/reorder/", { order: orderedIds });
  return res.data;
};

export const setFacebookPostFeatured = async (id, isFeatured) => {
  const res = await API.patch(`/manager/website/facebook-posts/${id}/`, { is_featured: isFeatured });
  return res.data;
};

// ═══════════════════════════════════════════════════════
// MEDIA & EVENTS
// ═══════════════════════════════════════════════════════

export const getMediaEvents = async (params = {}) => {
  const res = await API.get("/manager/website/media-events/", { params });
  return res.data;
};

// payload: { title, excerpt?, body, event_date?, is_active?, cover_image? (File), remove_cover_image? }
export const createMediaEvent = async (payload) => {
  const res = await API.post("/manager/website/media-events/", toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const updateMediaEvent = async (id, payload) => {
  const res = await API.patch(`/manager/website/media-events/${id}/`, toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const deleteMediaEvent = async (id) => {
  const res = await API.delete(`/manager/website/media-events/${id}/`);
  return res.data;
};

export const activateMediaEvent = async (id) => {
  const res = await API.post(`/manager/website/media-events/${id}/activate/`);
  return res.data;
};

export const deactivateMediaEvent = async (id) => {
  const res = await API.post(`/manager/website/media-events/${id}/deactivate/`);
  return res.data;
};

export const reorderMediaEvents = async (orderedIds) => {
  const res = await API.post("/manager/website/media-events/reorder/", { order: orderedIds });
  return res.data;
};

export const setMediaEventFeatured = async (id, isFeatured) => {
  const res = await API.patch(`/manager/website/media-events/${id}/`, { is_featured: isFeatured });
  return res.data;
};

// ═══════════════════════════════════════════════════════
// GALLERY
// ═══════════════════════════════════════════════════════

export const getGalleryImages = async (params = {}) => {
  const res = await API.get("/manager/website/gallery/", { params });
  return res.data;
};

// payload: { image (File), caption?, is_active? }
export const createGalleryImage = async (payload) => {
  const res = await API.post("/manager/website/gallery/", toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const updateGalleryImage = async (id, payload) => {
  const res = await API.patch(`/manager/website/gallery/${id}/`, toFormData(payload), MULTIPART_HEADERS);
  return res.data;
};

export const deleteGalleryImage = async (id) => {
  const res = await API.delete(`/manager/website/gallery/${id}/`);
  return res.data;
};

export const activateGalleryImage = async (id) => {
  const res = await API.post(`/manager/website/gallery/${id}/activate/`);
  return res.data;
};

export const deactivateGalleryImage = async (id) => {
  const res = await API.post(`/manager/website/gallery/${id}/deactivate/`);
  return res.data;
};

export const reorderGalleryImages = async (orderedIds) => {
  const res = await API.post("/manager/website/gallery/reorder/", { order: orderedIds });
  return res.data;
};