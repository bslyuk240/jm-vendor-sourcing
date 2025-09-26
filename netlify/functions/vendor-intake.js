// netlify/functions/vendor-intake.js
import { createClient } from '@supabase/supabase-js';

const TOKEN = 'JMvSource_92nF7x!qA4pLz#Xt8Kd';   // must match your client/app
const ADMIN_PIN = 'JM-Admin-2048';               // your admin PIN
const BUCKET = process.env.SUPABASE_BUCKET || 'vendor-images'; // storage bucket name

function resp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function parseDataUrl(dataUrl) {
  // data:[mime];base64,XXXX
  const m = /^data:(.*?);base64,(.*)$/i.exec(dataUrl || '');
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

function requireFields(obj, fields) {
  const missing = fields.filter(f => !obj[f] || String(obj[f]).trim() === '');
  if (missing.length) {
    const msg = `Missing required: ${missing.join(', ')}`;
    return { ok: false, error: msg, missing };
  }
  return { ok: true };
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') return resp(200, {});
    if (event.httpMethod !== 'POST') return resp(405, { ok:false, error:'method not allowed' });

    const body = JSON.parse(event.body || '{}');
    const action = String(body.action || 'create').toLowerCase();

    // Token check
    if (body.token !== TOKEN) return resp(401, { ok:false, error:'unauthorized' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
    if (!supabaseUrl || !serviceRole) {
      return resp(500, { ok:false, error:'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE' });
    }

    const supabase = createClient(supabaseUrl, serviceRole);

    // ---- DELETE (Admin) ----
    if (action === 'delete') {
      if (body.adminPin !== ADMIN_PIN) return resp(401, { ok:false, error:'admin unauthorized' });
      const ids = Array.isArray(body.ids)
        ? body.ids.map(x => String(x).trim()).filter(Boolean)
        : (body.id ? [String(body.id).trim()] : []);
      if (!ids.length) return resp(400, { ok:false, error:'no ids provided' });

      // Delete DB rows
      const { error: delErr, count } = await supabase
        .from('vendor_responses')
        .delete({ count: 'exact' })
        .in('entry_id', ids);
      if (delErr) return resp(500, { ok:false, error:String(delErr.message || delErr) });

      // (Optional) Also delete storage folder(s)
      // NOTE: deleteFolder works by listing and removing each object under path
      for (const id of ids) {
        const { data: list, error: listErr } = await supabase.storage.from(BUCKET).list(`${id}`);
        if (!listErr && list && list.length) {
          await supabase.storage.from(BUCKET).remove(list.map(o => `${id}/${o.name}`));
        }
      }

      return resp(200, { ok:true, deleted: count || 0 });
    }

    // ---- CREATE (default) ----
    // Minimal server-side validation (match your required fields)
    const requiredCheck = requireFields(body, ['vendorName', 'marketerName', 'category', 'interest', 'onboarding']);
    if (!requiredCheck.ok) return resp(400, { ok:false, error: requiredCheck.error, missing: requiredCheck.missing });

    const entryId = body.id || crypto.randomUUID(); // use client id or generate
    const images = Array.isArray(body.images) ? body.images : []; // [{ filename, dataUrl }]
    const uploadedUrls = [];

    // Upload images to Supabase Storage (if provided)
    if (images.length) {
      for (const img of images) {
        if (!img?.filename || !img?.dataUrl) continue;
        const parsed = parseDataUrl(img.dataUrl);
        if (!parsed) continue;
        const filePath = `${entryId}/${img.filename}`; // organize by entry
        const bytes = Buffer.from(parsed.base64, 'base64');

        // Upload (upsert true to allow replacing same filename)
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, bytes, { contentType: parsed.mime, upsert: true });
        if (upErr) {
          // don't fail whole request—just skip this image
          continue;
        }

        // Get public URL (bucket should be public)
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
        if (pub?.publicUrl) uploadedUrls.push(pub.publicUrl);
      }
    }

    // Build DB payload
    const payload = {
      entry_id: entryId,
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
      // store URLs (preferred) or fallback to any provided imageLinks
      image_links: uploadedUrls.length ? uploadedUrls.join(', ') : (body.imageLinks || null)
    };

    // Insert
    const { data, error } = await supabase
      .from('vendor_responses')
      .insert([payload])
      .select('id, created_at');

    if (error) return resp(500, { ok:false, error:String(error.message || error) });

    return resp(200, {
      ok: true,
      saved: 1,
      record: data?.[0] || null,
      uploaded: uploadedUrls.length,
      imageUrls: uploadedUrls
    });

  } catch (err) {
    return resp(500, { ok:false, error:String(err) });
  }
}
