const API_URL = "";

// The backend used to serve /uploads/<filename> as a raw static mount with
// no auth check. That's been replaced with an authenticated route,
// GET /api/uploads/{filename}, which means plain <img src="..."> /
// <video src="..."> tags can no longer be pointed at it directly (they
// can't attach an Authorization header). This fetches the file with the
// user's token and turns it into an in-memory blob: URL that <img>/<video>
// CAN use as a src.
//
// Returns null if there's no filename, the request fails, or the user
// isn't logged in — callers should treat a null return the same as "no
// image available".
export async function fetchAuthenticatedFileUrl(filename) {
  if (!filename) return null;

  try {
    const response = await fetch(`${API_URL}/api/uploads/${filename}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error(`Failed to load uploaded file ${filename}:`, err);
    return null;
  }
}