// netlify/functions/gsheets.js
const ENDPOINT = "https://script.google.com/macros/s/AKfycbzHcUhll6P1PozMJ4Z3xxftRXdcTctTNlPrbbynZ-GtpXce1Lptp05a8MnotqBbUJNOgA/exec";

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers, body: JSON.stringify({ ok:false, error:"Method Not Allowed" }) };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: event.body || "{}"
    });

    const ct = res.headers.get("content-type") || "";
    const text = await res.text();

    // If Apps Script ever returns HTML (login/error), convert to JSON so the app never throws "invalid JSON"
    if (!ct.includes("application/json")) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({ ok:false, error:"Non-JSON from Apps Script", status: res.status, snippet: text.slice(0,300) })
      };
    }

    return { statusCode: res.status, headers, body: text };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok:false, error:String(err?.message || err) }) };
  }
};
