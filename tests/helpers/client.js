export const createClient = (baseUrl) => {
  const jar = new Map();

  const updateCookies = (response) => {
    const cookies = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : [];

    for (const cookie of cookies) {
      const pair = cookie.split(";")[0];
      const separator = pair.indexOf("=");

      if (separator > 0) {
        jar.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
    }
  };

  const cookieHeader = () => {
    return [...jar.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  };

  const request = async (path, options = {}) => {
    const headers = { ...(options.headers || {}) };

    if (jar.size > 0) {
      headers.Cookie = cookieHeader();
    }

    let body = options.body;

    if (
      body !== undefined &&
      body !== null &&
      typeof body !== "string" &&
      !(body instanceof FormData) &&
      !(body instanceof Blob) &&
      !Buffer.isBuffer(body)
    ) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    const response = await fetch(baseUrl + path, {
      ...options,
      headers,
      body,
    });

    updateCookies(response);

    const text = await response.text();
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    return {
      status: response.status,
      body: parsed,
      headers: response.headers,
    };
  };

  return {
    request,
    jar,
    get cookieHeader() {
      return cookieHeader();
    },
  };
};
