// Automatically uses the IP address of the machine hosting the app
const API_BASE_URL = `http://${window.location.hostname}:8000/api`;

export const bootstrapUser = async () => {
  const res = await fetch(`${API_BASE_URL}/user/bootstrap`, {
    credentials: "include",
  });
  return res.json();
};

export const fetchCurrentWeather = async (lat, lon, location) => {
  const res = await fetch(
    `${API_BASE_URL}/weather/current?lat=${lat}&lon=${lon}&location=${encodeURIComponent(location)}`,
    { credentials: "include" }
  );
  return res.json();
};

export const sendWeatherQuery = async (payload) => {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const getChatHistory = async () => {
  const res = await fetch(`${API_BASE_URL}/chat/history`, {
    credentials: "include",
  });
  return res.json();
};

export const deleteChatHistory = async () => {
  const res = await fetch(`${API_BASE_URL}/chat/history`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.json();
};