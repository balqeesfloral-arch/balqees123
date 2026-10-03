import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const Ctx = createContext(null);
const bool=(v)=>Boolean(v);

export function ClientPortalProvider({ session, lang, setLang, children }) {
  const [profile,setProfile]=useState(null);
  const [organization,setOrganization]=useState(null);
  const [membership,setMembership]=useState(null);
  const [memberships,setMemberships]=useState([]);
  const [effectivePermissions,setEffectivePermissions]=useState({});
  const [siteScope,setSiteScope]=useState([]);
  const [securityAccess,setSecurityAccess]=useState({mfa_enabled:false,mfa_required:false,aal2:false});
  const [preferences,setPreferences]=useState(null);
  const [portalSettings,setPortalSettings]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const refresh = useCallback(async (preferredOrgId=null) => {
    if (!supabase || !session?.user?.id) return;
    setLoading(true); setError('');
    const userId=session.user.id;
    const [p,pref,ms]=await Promise.all([
      supabase.from('customer_profiles').select('*').eq('id',userId).maybeSingle(),
      supabase.from('client_preferences').select('*').eq('user_id',userId).maybeSingle(),
      supabase.rpc('get_my_organization_memberships_v2'),
    ]);
    if(p.error)setError(p.error.message||'profile_load_failed');
    if(pref.error)setError(pref.error.message||'preferences_load_failed');
    setProfile(p.data||null); setPreferences(pref.data||null);

    let list=Array.isArray(ms.data)?ms.data:[];
    if(ms.error){
      const fallback=await supabase.from('organization_members').select('*').eq('user_id',userId).eq('status','active').order('joined_at');
      if(fallback.error)setError(fallback.error.message||ms.error.message||'membership_load_failed');
      list=(fallback.data||[]).map(x=>({organization_id:x.organization_id,member_role:x.member_role,status:x.status,joined_at:x.joined_at,access_expires_at:x.access_expires_at,_legacy:x}));
    }
    setMemberships(list);
    const saved=preferredOrgId||localStorage.getItem('balqees-portal-org');
    const chosen=list.find(x=>x.organization_id===saved)||list[0]||null;
    if(!chosen){setOrganization(null);setMembership(null);setEffectivePermissions({});setSiteScope([]);setLoading(false);return;}
    localStorage.setItem('balqees-portal-org',chosen.organization_id);

    const [orgRes,accessRes,settingsRes]=await Promise.all([
      supabase.from('organizations').select('*').eq('id',chosen.organization_id).maybeSingle(),
      supabase.rpc('get_my_organization_access_v2',{p_organization_id:chosen.organization_id}),
      supabase.rpc('get_my_portal_settings_v1',{p_organization_id:chosen.organization_id}),
    ]);
    if(orgRes.error)setError(orgRes.error.message||'organization_load_failed');
    setOrganization(orgRes.data||null);
    setPortalSettings(!settingsRes.error&&settingsRes.data?settingsRes.data:null);
    if(!accessRes.error&&accessRes.data){
      setMembership(accessRes.data.membership||chosen._legacy||chosen);
      setEffectivePermissions(accessRes.data.permissions||{});
      setSiteScope(accessRes.data.site_ids||[]);
      setSecurityAccess({mfa_enabled:bool(accessRes.data.mfa_enabled),mfa_required:bool(accessRes.data.mfa_required),aal2:bool(accessRes.data.aal2)});
    } else {
      const m=chosen._legacy||(await supabase.from('organization_members').select('*').eq('organization_id',chosen.organization_id).eq('user_id',userId).maybeSingle()).data;
      setMembership(m||chosen); setSiteScope([]); setSecurityAccess({mfa_enabled:false,mfa_required:bool(m?.mfa_required),aal2:false});
      setEffectivePermissions({
        place_orders:['owner','admin'].includes(m?.member_role)||bool(m?.can_place_orders),
        accept_quotes:['owner','admin'].includes(m?.member_role)||bool(m?.can_accept_quotes),
        view_finance:['owner','admin'].includes(m?.member_role)||bool(m?.can_view_finance),
        manage_sites:['owner','admin'].includes(m?.member_role)||bool(m?.can_manage_sites),
        manage_team:['owner','admin'].includes(m?.member_role)||bool(m?.can_manage_team),
        manage_profile:['owner','admin'].includes(m?.member_role)||bool(m?.can_manage_profile),
      });
      if(accessRes.error)setError(accessRes.error.message||'access_load_failed');
    }
    setLoading(false);
  },[session?.user?.id]);

  useEffect(()=>{refresh();},[refresh]);

  const setActiveOrganization=useCallback(async(orgId)=>{if(!orgId)return;localStorage.setItem('balqees-portal-org',orgId);await refresh(orgId);},[refresh]);

  const permissions=useMemo(()=>{
    const p=effectivePermissions||{};
    const owner=['owner','admin'].includes(membership?.member_role);
    const read=(key,legacy)=>owner||bool(p[key])||bool(p[legacy]);
    const viewFinance=read('view_financial_documents','view_finance');
    const acceptQuotes=read('approve_quotations','accept_quotes');
    const priceRule=portalSettings?.organization_settings?.price_visibility_rule||'permission';
    const explicitPrice=owner||bool(p.view_prices);
    const canSeePrices=priceRule==='finance_only'?viewFinance:priceRule==='approvers_finance'?(viewFinance||acceptQuotes):(explicitPrice||viewFinance||acceptQuotes);
    return {
      ...p, owner, priceRule, canSeePrices,
      placeOrders:read('create_orders','place_orders'), acceptQuotes, viewFinance,
      manageSites:read('manage_sites','manage_sites'), manageTeam:read('manage_team','manage_team'), manageProfile:read('manage_profile','manage_profile'),
      viewOrders:read('view_orders','view_orders'), editOrders:read('edit_orders','edit_orders'), viewQuotes:read('view_quotations','view_quotations'),
      viewContracts:read('view_contracts','view_contracts'), viewSites:read('view_sites','view_sites'), viewTeam:read('view_team','view_team'), viewCatalog:read('view_catalog','view_catalog'),
      manageSettings:read('manage_settings','manage_settings'), createSupportCases:read('create_support_cases','create_support_cases'),
    };
  },[membership,effectivePermissions,portalSettings]);

  const value=useMemo(()=>({
    session,lang,setLang,profile,organization,membership,memberships,preferences,portalSettings,permissions,effectivePermissions,siteScope,securityAccess,
    loading,error,refresh,setActiveOrganization,setPreferences,setPortalSettings,setProfile,setOrganization,
  }),[session,lang,setLang,profile,organization,membership,memberships,preferences,portalSettings,permissions,effectivePermissions,siteScope,securityAccess,loading,error,refresh,setActiveOrganization]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientPortal(){const value=useContext(Ctx);if(!value)throw new Error('useClientPortal must be used inside ClientPortalProvider');return value;}
