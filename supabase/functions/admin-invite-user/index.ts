// ============================================================================
// Edge Function: admin-invite-user
//
// Creates a staff account and its membership row for apps/admin-web.
//
// This is the ONLY part of the admin dashboard that needs the service-role key.
// Everything else in apps/admin-web runs on the signed-in user's own JWT so
// Postgres RLS decides what they can see and change; the one thing RLS cannot
// do is mint an auth.users row, because that lives in the auth schema behind
// the Admin API. Keeping that capability here means the service-role key stays
// inside Supabase and never ships to a Next.js server that also renders pages.
//
// Because this function CAN bypass RLS, it re-establishes the caller's identity
// and permissions itself before doing anything:
//   1. Read the caller's JWT from the Authorization header.
//   2. Resolve who they are with an anon-key client bound to that JWT — so
//      auth.uid() is theirs, not the service role's.
//   3. Ask the database (still as them) whether they may administer the target
//      scope. is_platform_admin() and their org/food-court membership answer
//      that; this function never decides it on its own.
//   4. Only then use the service-role client, and only for the exact insert.
//
// A caller who is neither a platform admin nor an owner of the target scope
// gets 403 and nothing happens.
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type MemberRole = 'owner' | 'manager' | 'staff'

interface InviteBody {
  email?: string
  password?: string
  displayName?: string
  role?: MemberRole
  // Exactly one scope must be given.
  orgId?: string
  restaurantId?: string
  foodCourtId?: string
}

const ALLOWED_ROLES: MemberRole[] = ['owner', 'manager', 'staff']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

  // Caller-scoped client: anon key + the caller's JWT, so every query below is
  // evaluated as them under RLS.
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const {
    data: { user: caller },
    error: callerError,
  } = await asCaller.auth.getUser()

  if (callerError || !caller) return json({ error: 'unauthorized' }, 401)

  let body: InviteBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const displayName = String(body.displayName ?? '').trim().slice(0, 120)
  const role = body.role ?? 'staff'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid_email' }, 400)
  // Supabase enforces its own minimum too; this is the floor we require.
  if (password.length < 12) return json({ error: 'weak_password' }, 400)
  if (!ALLOWED_ROLES.includes(role)) return json({ error: 'invalid_role' }, 400)

  const orgId = body.orgId?.trim() || null
  const restaurantId = body.restaurantId?.trim() || null
  const foodCourtId = body.foodCourtId?.trim() || null

  for (const id of [orgId, restaurantId, foodCourtId]) {
    if (id && !UUID_RE.test(id)) return json({ error: 'invalid_scope_id' }, 400)
  }

  if (foodCourtId && (orgId || restaurantId)) return json({ error: 'ambiguous_scope' }, 400)
  if (!foodCourtId && !orgId) return json({ error: 'missing_scope' }, 400)

  // ─── Authorization, asked of the database as the caller ───────────────────

  const { data: isPlatformAdmin } = await asCaller.rpc('is_platform_admin')

  let permitted = isPlatformAdmin === true

  if (!permitted && foodCourtId) {
    const { data: isOwner } = await asCaller.rpc('is_food_court_owner', {
      p_food_court_id: foodCourtId,
    })
    permitted = isOwner === true
  }

  if (!permitted && orgId) {
    // Owners may add people to their own organization only. This reads
    // org_members under RLS, so it can only ever see the caller's own org.
    const { data: membership } = await asCaller
      .from('org_members')
      .select('role, org_id')
      .eq('user_id', caller.id)
      .maybeSingle()

    permitted = membership?.role === 'owner' && membership.org_id === orgId
  }

  if (!permitted) return json({ error: 'forbidden' }, 403)

  // A restaurant, if named, must belong to the organization being granted —
  // otherwise an owner could attach a member to someone else's restaurant.
  if (restaurantId) {
    const { data: restaurant } = await asCaller
      .from('restaurants')
      .select('id, org_id')
      .eq('id', restaurantId)
      .maybeSingle()

    if (!restaurant) return json({ error: 'restaurant_not_found' }, 404)
    if (orgId && restaurant.org_id !== orgId) return json({ error: 'scope_mismatch' }, 400)
  }

  // ─── Privileged work, now that the caller has been vouched for ────────────

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName || email },
  })

  if (createError || !created.user) {
    // Surface "already registered" distinctly so the UI can suggest editing the
    // existing member instead; everything else stays generic.
    const already = createError?.message?.toLowerCase().includes('already')
    return json({ error: already ? 'email_taken' : 'create_failed' }, already ? 409 : 500)
  }

  const membershipInsert = foodCourtId
    ? admin.from('food_court_members').insert({
        user_id: created.user.id,
        food_court_id: foodCourtId,
        role,
        display_name: displayName || email,
      })
    : admin.from('org_members').insert({
        user_id: created.user.id,
        org_id: orgId,
        restaurant_id: restaurantId,
        role,
        display_name: displayName || email,
      })

  const { error: membershipError } = await membershipInsert

  if (membershipError) {
    // Without a membership row the account can authenticate but resolves to an
    // empty scope — a confusing half-created user. Roll it back.
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: 'membership_failed', detail: membershipError.message }, 500)
  }

  return json({ ok: true, userId: created.user.id })
})
