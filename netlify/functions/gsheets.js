
const ENDPOINT = "https://script.google.com/macros/s/AKfycbyFt5olcprecR3l5z52hW9CT_aFx-VJVrZI7hlY6gGht7o9fnPUAHfTyC1aqpt8XdKyCg/exec";

exports.handler = async function(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok:false, error:"Method Not Allowed" }) };
  }

  try {
    const body = event.body || "{}";

    const fetch = (await import("node-fetch")).default;
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });

    const text = await res.text();
    return {
      statusCode: res.status,
      headers: { ...headers, "Content-Type": "application/json" },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok:false, error: String(err && err.message || err) })
    };
  }
};
