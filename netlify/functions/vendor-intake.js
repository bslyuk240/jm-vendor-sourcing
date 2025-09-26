// netlify/functions/vendor-intake.js
import { createClient } from '@supabase/supabase-js';

const TOKEN = 'JMvSource_92nF7x!qA4pLz#Xt8Kd';   // must match your client/app
const ADMIN_PIN = 'JM-Admin-2048';               // your admin PIN

function resp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return resp(200, {}); // CORS preflight (optional)
    }
    if (event.httpMethod !== 'POST') {
      return resp(405, { ok: false, error: 'method not allowed' });
    }

    const body = JSON.parse(event.body || '{}');
    const action = String(body.action || 'create').toLowerCase();

    if (body.token !== TOKEN) {
      return resp(401, { ok: false, error: 'unauthorized' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
    if (!supabaseUrl || !serviceRole) {
      return resp(500, { ok: false, error: 'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE' });
    }

    const supabase = createClient(supabaseUrl, serviceRole);

    if (action === 'delete') {
      // Admin-only delete by entry_id (single or batch)
      if (body.adminPin !== ADMIN_PIN) {
        return resp(401, { ok: false, error: 'admin unauthorized' });
      }
      const ids = Array.isArray(body.ids)
        ? body.ids.map(v => String(v).trim()).filter(Boolean)
        : body.id ? [String(body.id).trim()] : [];
      if (!ids.length) return resp(400, { ok: false, error: 'no ids provided' });

      const { error: delErr, count } = await supabase
        .from('vendor_responses')
        .delete({ count: 'exact' })
        .in('entry_id', ids);

      if (delErr) return resp(500, { ok: false, error: String(delErr.message || delErr) });
      return resp(200, { ok: true, deleted: count || 0 });
    }

    // Default: create/save
    const payload = {
      entry_id: body.id || null,
      marketer_name: body.marketerName || null,
      marketer_phone: body.marketerPhone || null,
      marketer_email: body.marketerEmail || null,
      vendor_name: body.vendorName || null,
      contact_person: body.contactPerson || null,
      vendor_phone: body.vendorPhone || null,
      vendor_email: body.vendorEmail || null,
      business_address: body.businessAddress || null,
      category: body.category || null,
      sells_online: body.sellsOnline || null,
      where_online: body.whereOnline || null,
      interest: body.interest || null,
      onboarding: body.onboarding || null,
      challenges: body.challenges || null,
      comments: body.comments || null,
      device: body.device || null,
      image_links: body.imageLinks || null,
    };

    const { data, error } = await supabase
      .from('vendor_responses')
      .insert([payload])
      .select('id, created_at');

    if (error) return resp(500, { ok: false, error: String(error.message || error) });
    return resp(200, { ok: true, saved: 1, record: data?.[0] || null });
  } catch (err) {
    return resp(500, { ok: false, error: String(err) });
  }
}
