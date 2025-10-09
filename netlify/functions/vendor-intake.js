import { createClient } from '@supabase/supabase-js';

const TOKEN = 'JMvSource_92nF7x!qA4pLz#Xt8Kd';

// Accept either _KEY or plain
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method not allowed' });

    let body = {};
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { ok: false, error: 'invalid JSON body' }); }

    if (body.token !== TOKEN) return json(401, { ok: false, error: 'unauthorized' });
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
      const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
      if (!ids.length) return json(400, { ok:false, error:'no ids provided' });

      const { error, count } = await supabase
        .from('vendor_responses')
        .delete({ count: 'exact' })
        .in('entry_id', ids.map(String));

      if (error) return json(500, { ok:false, error:error.message || String(error) });
      return json(200, { ok:true, deleted: count || 0 });
    }

    if (action === 'list') {
      const { data, error } = await supabase.from('vendor_responses').select('*').limit(20);
      if (error) return json(500, { ok:false, error:error.message || error });
      return json(200, { ok:true, rows:data });
    }

    if (action === 'get-settings') {
      // Get the settings - we'll store a single row with id = 'main'
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'main')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        return json(500, { ok: false, error: error.message });
      }

      return json(200, { 
        ok: true, 
        logoUrl: data?.logo_url || null 
      });
    }

    if (action === 'save-settings') {
      const logoUrl = body.logoUrl || null;

      // Upsert the settings
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ 
          id: 'main', 
          logo_url: logoUrl,
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, saved: true, logoUrl });
    }

    return json(400, { ok:false, error:'unknown action' });
  } catch (err) {
    return json(500, { ok:false, error: err?.message || String(err) });
  }
}
