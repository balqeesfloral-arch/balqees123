import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.BALQEES_ADMIN_EMAIL;
const password = process.env.BALQEES_ADMIN_PASSWORD;

function required(name, value) {
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

required('SUPABASE_URL (or VITE_SUPABASE_URL)', url);
required('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey);
required('BALQEES_ADMIN_EMAIL', email);
required('BALQEES_ADMIN_PASSWORD', password);

if (password.length < 8) throw new Error('BALQEES_ADMIN_PASSWORD must be at least 8 characters.');

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const normalizedEmail = email.trim().toLowerCase();
const baseUserMetadata = {
  account_type: 'company',
  full_name: 'مدير النظام',
  username: 'balqees_admin',
  phone: '',
  establishment_display_name: 'بلقيس الورد للزهور والنباتات',
  organization: {
    legal_name: 'بلقيس الورد للزهور والنباتات',
    contact_role: 'system_admin',
  },
  national_address: {},
  source: 'balqees-admin-bootstrap',
  profile_version: 2,
};

const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

let user = usersData.users.find(item => item.email?.toLowerCase() === normalizedEmail);

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: baseUserMetadata,
    app_metadata: { role: 'admin' },
  });
  if (error) throw error;
  user = data.user;
  console.log(`Admin auth user created: ${user.id}`);
} else {
  const { data, error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { ...user.user_metadata, ...baseUserMetadata },
    app_metadata: { ...user.app_metadata, role: 'admin' },
  });
  if (error) throw error;
  user = data.user;
  console.log(`Existing auth user promoted to admin: ${user.id}`);
}

const profilePayload = {
  id: user.id,
  account_type: 'company',
  username: 'balqees_admin',
  full_name: 'مدير النظام',
  phone: '',
  establishment_display_name: 'بلقيس الورد للزهور والنباتات',
  organization: baseUserMetadata.organization,
  personal: null,
  national_address: {},
  profile_version: 2,
  role: 'admin',
};

const { error: profileError } = await admin
  .from('customer_profiles')
  .upsert(profilePayload, { onConflict: 'id' });

if (profileError) {
  console.warn('Auth admin user is ready, but customer_profiles could not be updated. Apply SUPABASE-ADMIN-ROLE.sql first if needed.');
  console.warn(profileError.message);
} else {
  console.log('customer_profiles role set to admin.');
}

console.log(`Balqees system administrator ready: ${normalizedEmail}`);
