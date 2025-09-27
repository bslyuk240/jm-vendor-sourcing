import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // must be service role for delete
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TOKEN = 'JMvSource_92nF7x!qA4pLz#Xt8Kd';   // must match your frontend
const ADMIN_PIN = '2048';                        // update to your chosen PIN

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return resp(405, { ok: false, error: 'method not allowed' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return resp(400, { ok: false, error: 'invalid JSON body' });
  }

  // Check token
  if (body.token !== TOKEN) {
    return resp(401, { ok: false, error: 'unauthorized' });
  }

  const action = (body.action || 'create').toLowerCase();

  try {
    // 🔹 Create/save
    if (action === 'create') {
      const payload = {
        entry_id: body.id || crypto.randomUUID(),
        marketer_name: body.marketerName || '',
        marketer_phone: body.marketerPhone || '',
        marketer_email: body.marketerEmail || '',
        vendor_name: body.vendorName || '',
        contact_person: body.contactPerson || '',
        vendor_phone: body.vendorPhone || '',
        vendor_email: body.vendorEmail || '',
        business_address: body.businessAddress || '',
        category: body.category || '',
        sells_online: body.sellsOnline || '',
        where_online: body.whereOnline || '',
        interest: body.interest || '',
        onboarding: body.onboarding || '',
        challenges: body.challenges || '',
        comments: body.comments || '',
        device: body.device || ''
      };

      const { data, error } = await supabase
        .from('vendor_responses')
        .insert([payload])
        .select();

      if (error) throw error;

      return resp(200, { ok: true, saved: 1, record: data[0] });
    }

    // 🔹 Delete
    if (action === 'delete') {
      if (body.adminPin !== ADMIN_PIN) {
        return resp(401, { ok: false, error: 'admin unauthorized' });
      }

      const ids = Array.isArray(body.ids)
        ? body.ids.map(String)
        : body.id
        ? [String(body.id)]
        : [];

      if (!ids.length) {
        return resp(400, { ok: false, error: 'no ids provided' });
      }

      // Try by entry_id first
      let { error: delErr, count } = await supabase
        .from('vendor_responses')
        .delete({ count: 'exact' })
        .in('entry_id', ids);

      // If nothing deleted, try by id (numeric or uuid)
      if (!delErr && (!count || count === 0)) {
        const byId = await supabase
          .from('vendor_responses')
          .delete({ count: 'exact' })
          .in('id', ids);
        delErr = byId.error;
        count = byId.count;
      }

      if (delErr) throw delErr;

      return resp(200, { ok: true, deleted: count || 0 });
    }

    // 🔹 List (debugging)
    if (action === 'list') {
      const { data, error } = await supabase
        .from('vendor_responses')
        .select('*')
        .limit(10);

      if (error) throw error;

      return resp(200, { ok: true, rows: data });
    }

    return resp(400, { ok: false, error: 'unknown action' });
  } catch (err) {
    return resp(500, { ok: false, error: String(err) });
  }
}

// Helper: JSON response
function resp(status, payload) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
}
