import { createClient } from '@supabase/supabase-js';

const TOKEN = 'JMvSource_92nF7x!qA4pLz#Xt8Kd';
const ADMIN_PIN = '2048';

// Accept either name (some sites used _KEY, some without)
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ''));
}

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'method not allowed' });

    let body = {};
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { ok:false, error:'invalid JSON body' }); }

    if (body.token !== TOKEN) return json(401, { ok:false, error:'unauthorized' });
    if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { ok:false, error:'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE(_KEY)' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const action = String(body.action || 'create').toLowerCase();

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

      const { data, error } = await supabase.from('vendor_responses').insert([payload]).select('*');
      if (error) return json(500, { ok:false, error: error.message || error });
      return json(200, { ok:true, saved:1, record: data?.[0] || null });
    }

    if (action === 'delete') {
      if (body.adminPin !== ADMIN_PIN) return json(401, { ok:false, error:'admin unauthorized' });

      // normalize to ids[]
      const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
      if (!ids.length) return json(400, { ok:false, error:'no ids provided' });

      // 1) try by entry_id (text)
      let delErr = null, count = 0;
      try {
        const res = await supabase
          .from('vendor_responses')
          .delete({ count: 'exact' })
          .in('entry_id', ids.map(String));
        delErr = res.error;
        count = res.count || 0;
      } catch (e) {
        delErr = e;
      }

      // 2) if none deleted AND ids look like uuids, try by id (uuid)
      if (!delErr && count === 0 && ids.every(isUuid)) {
        try {
          const res2 = await supabase
            .from('vendor_responses')
            .delete({ count: 'exact' })
            .in('id', ids);
          delErr = res2.error;
          count = res2.count || 0;
        } catch (e2) {
          delErr = e2;
        }
      }

      if (delErr) {
        // show real message instead of [object Object]
        const msg = delErr.message || JSON.stringify(delErr);
        return json(500, { ok:false, error: msg });
      }
      return json(200, { ok:true, deleted: count });
    }

    if (action === 'list') {
      const { data, error } = await supabase.from('vendor_responses').select('*').limit(10);
      if (error) return json(500, { ok:false, error: error.message || error });
      return json(200, { ok:true, rows: data });
    }

    return json(400, { ok:false, error:'unknown action' });
  } catch (err) {
    return json(500, { ok:false, error: err?.message || String(err) });
  }
}
