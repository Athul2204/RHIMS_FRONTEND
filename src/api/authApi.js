// src/api/authApi.js
import API from "./index";

/**
 * Login user
 */
export const loginUser = async (credentials) => {
  const response = await API.post("/auth/login/", credentials);
  return response.data;
};

/**
 * Logout user
 */
export const logoutUser = async () => {
  const response = await API.post("/auth/logout/");
  return response.data;
};

/**
 * Get logged-in user (IMPORTANT FIX)
 */
export const getMeUser = async () => {
  const response = await API.get("/auth/me/");
  return response.data;
};