import { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { safeQuoteReturn } from '../lib/quoteRequests';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Eye,
  EyeOff,
  FileCheck2,
  Globe2,
  KeyRound,
  Landmark,
  LocateFixed,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  cleanEmail,
  isValidBirthDate,
  isValidBuildingNumber,
  isValidEmail,
  isValidPostalCode,
  isValidSaudiPhone,
  isValidSecondaryNumber,
  isValidShortAddress,
  isValidUnifiedCommercialNumber,
  isValidUsername,
  isValidVatNumber,
  normalizeSaudiPhone,
  passwordScore,
} from '../lib/authValidation';

const initialForm = {
  accountType: '',
  fullName: '',
  username: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  establishmentDisplayName: '',
  legalName: '',
  entityType: 'company',
  contactRole: '',
  commercialNumber: '',
  vatRegistered: true,
  vatNumber: '',
  website: '',
  birthDate: '',
  gender: '',
  city: '',
  district: '',
  street: '',
  buildingNumber: '',
  secondaryNumber: '',
  postalCode: '',
  unitNumber: '',
  shortAddress: '',
  mapsUrl: '',
  latitude: '',
  longitude: '',
  consent: false,
};

function fieldValue(value) {
  return String(value || '').trim();
}

export default function Signup({ lang }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const location=useLocation();
  const quoteReturn=safeQuoteReturn(new URLSearchParams(location.search).get('next'));
  const accountPath=quoteReturn?`/account?next=${encodeURIComponent(quoteReturn)}`:'/account';
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState(null);
  const [completed, setCompleted] = useState(false);
  const score = useMemo(() => passwordScore(form.password), [form.password]);
  const hasAccountType = form.accountType === 'company' || form.accountType === 'individual';
  const isCompany = form.accountType === 'company';
  const totalSteps = isCompany ? 4 : 3;
  const NextIcon = ar ? ChevronLeft : ChevronRight;
  const PrevIcon = ar ? ChevronRight : ChevronLeft;

  const steps = isCompany
    ? [
        ar ? 'بيانات الحساب' : 'Account',
        ar ? 'بيانات المنشأة' : 'Organization',
        ar ? 'العنوان الوطني' : 'National address',
        ar ? 'المراجعة' : 'Review',
      ]
    : [
        ar ? 'البيانات الشخصية' : 'Personal details',
        ar ? 'العنوان' : 'Address',
        ar ? 'المراجعة' : 'Review',
      ];

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
    setMessage(null);
  };

  const setAccountType = type => {
    setForm(prev => ({ ...prev, accountType: type }));
    setStep(1);
    setErrors({});
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetAccountType = () => {
    setForm(prev => ({ ...prev, accountType: '' }));
    setStep(1);
    setErrors({});
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const inputClass = key => errors[key] ? 'signup-input invalid' : 'signup-input';

  function validateAccountStep() {
    const next = {};
    if (fieldValue(form.fullName).length < 3) next.fullName = ar ? 'اكتب الاسم الكامل.' : 'Enter your full name.';
    if (!isValidUsername(form.username)) next.username = ar ? '3–30 حرفًا أو رقمًا، ويمكن استخدام . _ - بدون مسافات.' : 'Use 3–30 letters or numbers; . _ - are allowed, without spaces.';
    if (!isValidSaudiPhone(form.phone)) next.phone = ar ? 'اكتب رقم جوال سعودي صحيحًا مثل 05xxxxxxxx.' : 'Enter a valid Saudi mobile number such as 05xxxxxxxx.';
    if (!isValidEmail(form.email)) next.email = ar ? 'اكتب بريدًا إلكترونيًا صحيحًا.' : 'Enter a valid email address.';
    if (form.password.length < 8 || score < 2) next.password = ar ? 'استخدم 8 أحرف على الأقل ومزيجًا من الحروف والأرقام.' : 'Use at least 8 characters with letters and numbers.';
    if (form.password !== form.confirmPassword) next.confirmPassword = ar ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.';
    if (isCompany && fieldValue(form.establishmentDisplayName).length < 2) next.establishmentDisplayName = ar ? 'اكتب اسم المنشأة الذي تريد ظهوره في الحساب.' : 'Enter the organization name to display in the account.';
    if (!isCompany) {
      if (!isValidBirthDate(form.birthDate)) next.birthDate = ar ? 'اختر تاريخ ميلاد صحيحًا.' : 'Choose a valid birth date.';
      if (!form.gender) next.gender = ar ? 'اختر الجنس.' : 'Select gender.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateOrganizationStep() {
    const next = {};
    if (fieldValue(form.legalName).length < 2) next.legalName = ar ? 'اكتب الاسم التجاري أو القانوني للمنشأة.' : 'Enter the organization legal or trade name.';
    if (!form.entityType) next.entityType = ar ? 'اختر نوع المنشأة.' : 'Select organization type.';
    if (!isValidUnifiedCommercialNumber(form.commercialNumber)) next.commercialNumber = ar ? 'الرقم الموحد يجب أن يكون 10 أرقام ويبدأ بالرقم 7.' : 'The unified commercial number must be 10 digits and start with 7.';
    if (form.vatRegistered && !isValidVatNumber(form.vatNumber)) next.vatNumber = ar ? 'الرقم الضريبي يجب أن يكون 15 رقمًا ويبدأ وينتهي بالرقم 3.' : 'VAT number must contain 15 digits and start and end with 3.';
    if (form.website && !/^https?:\/\//i.test(form.website.trim())) next.website = ar ? 'ابدأ الرابط بـ https:// أو http://.' : 'Start the URL with https:// or http://.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateAddressStep() {
    const next = {};
    if (fieldValue(form.city).length < 2) next.city = ar ? 'اكتب المدينة.' : 'Enter the city.';
    if (fieldValue(form.district).length < 2) next.district = ar ? 'اكتب الحي.' : 'Enter the district.';
    if (fieldValue(form.street).length < 2) next.street = ar ? 'اكتب اسم الشارع.' : 'Enter the street name.';
    if (!isValidBuildingNumber(form.buildingNumber)) next.buildingNumber = ar ? 'رقم المبنى 4 أرقام.' : 'Building number must be 4 digits.';
    if (!isValidSecondaryNumber(form.secondaryNumber)) next.secondaryNumber = ar ? 'الرقم الفرعي 4 أرقام.' : 'Secondary number must be 4 digits.';
    if (!isValidPostalCode(form.postalCode)) next.postalCode = ar ? 'الرمز البريدي 5 أرقام.' : 'Postal code must be 5 digits.';
    if (!isValidShortAddress(form.shortAddress)) next.shortAddress = ar ? 'العنوان المختصر يتكون من 4 أحرف ثم 4 أرقام، مثل RHMA3184.' : 'Short address is 4 letters followed by 4 digits, e.g. RHMA3184.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function nextStep() {
    let valid = false;
    if (step === 1) valid = validateAccountStep();
    else if (isCompany && step === 2) valid = validateOrganizationStep();
    else valid = validateAddressStep();
    if (!valid) return;
    setStep(s => Math.min(totalSteps, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function previousStep() {
    setErrors({});
    setMessage(null);
    if (step === 1) {
      resetAccountType();
      return;
    }
    setStep(s => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function useCurrentLocation() {
    setMessage(null);
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: ar ? 'المتصفح لا يدعم تحديد الموقع.' : 'This browser does not support geolocation.' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        setForm(prev => ({
          ...prev,
          latitude,
          longitude,
          mapsUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
        }));
        setLocating(false);
        setMessage({ type: 'success', text: ar ? 'تم التقاط موقعك. أكمل بيانات العنوان الوطني للتأكد من دقة العنوان.' : 'Location captured. Complete the National Address fields to confirm the address.' });
      },
      () => {
        setLocating(false);
        setMessage({ type: 'error', text: ar ? 'تعذر الوصول إلى موقعك. يمكنك لصق رابط الموقع من Google Maps بدلًا من ذلك.' : 'We could not access your location. You can paste a Google Maps link instead.' });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function submitSignup() {
    setMessage(null);
    if (!form.consent) {
      setErrors({ consent: ar ? 'يلزم تأكيد صحة البيانات والموافقة على استخدامها لإنشاء الحساب.' : 'Confirm the information and consent to its use for account creation.' });
      return;
    }
    if (!supabase) {
      setMessage({ type: 'error', text: ar ? 'يلزم ربط إعدادات Supabase لتفعيل إنشاء الحساب على الموقع المنشور.' : 'Connect the Supabase settings to enable live account creation.' });
      return;
    }

    setLoading(true);
    const metadata = {
      account_type: form.accountType,
      full_name: fieldValue(form.fullName),
      username: fieldValue(form.username),
      phone: normalizeSaudiPhone(form.phone),
      establishment_display_name: isCompany ? fieldValue(form.establishmentDisplayName) : '',
      organization: isCompany ? {
        legal_name: fieldValue(form.legalName),
        entity_type: form.entityType,
        contact_role: fieldValue(form.contactRole),
        unified_commercial_number: form.commercialNumber.replace(/\D/g, ''),
        vat_registered: Boolean(form.vatRegistered),
        vat_number: form.vatRegistered ? form.vatNumber.replace(/\D/g, '') : '',
        website: fieldValue(form.website),
      } : null,
      personal: !isCompany ? {
        birth_date: form.birthDate,
        gender: form.gender,
      } : null,
      national_address: {
        city: fieldValue(form.city),
        district: fieldValue(form.district),
        street: fieldValue(form.street),
        building_number: form.buildingNumber.replace(/\D/g, ''),
        secondary_number: form.secondaryNumber.replace(/\D/g, ''),
        postal_code: form.postalCode.replace(/\D/g, ''),
        unit_number: fieldValue(form.unitNumber),
        short_address: fieldValue(form.shortAddress).toUpperCase(),
        maps_url: fieldValue(form.mapsUrl),
        latitude: form.latitude || null,
        longitude: form.longitude || null,
      },
      source: 'balqees-floral-website',
      profile_version: 2,
    };

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail(form.email),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}${accountPath}`,
        data: metadata,
      },
    });
    setLoading(false);

    if (error) {
      const m = (error.message || '').toLowerCase();
      let text = ar ? 'تعذر إنشاء الحساب الآن. راجع البيانات وحاول مرة أخرى.' : 'We could not create the account. Review your details and try again.';
      if (m.includes('already') || m.includes('registered')) text = ar ? 'يوجد حساب بهذا البريد بالفعل. استخدم تسجيل الدخول أو استعادة كلمة المرور.' : 'An account already exists with this email. Sign in or reset the password.';
      if (m.includes('database') || m.includes('saving new user')) text = ar ? 'تعذر حفظ ملف العميل. قد يكون اسم المستخدم مستخدمًا بالفعل أو يلزم تطبيق إعداد قاعدة البيانات المرفق.' : 'The customer profile could not be saved. The username may already be used, or the included database setup may still need to be applied.';
      setMessage({ type: 'error', text });
      return;
    }

    if (data.session) {
      navigate(accountPath, { replace: true });
    } else {
      setCompleted(true);
      setMessage({ type: 'success', text: ar ? 'تم إنشاء الحساب. أرسلنا رابط التفعيل إلى بريدك الإلكتروني.' : 'Account created. We sent an activation link to your email.' });
    }
  }

  const reviewRows = isCompany
    ? [
        [ar ? 'نوع الحساب' : 'Account type', ar ? 'منشأة' : 'Organization'],
        [ar ? 'الاسم الكامل' : 'Full name', form.fullName],
        [ar ? 'اسم المستخدم' : 'Username', form.username],
        [ar ? 'الجوال' : 'Mobile', normalizeSaudiPhone(form.phone)],
        [ar ? 'البريد الإلكتروني' : 'Email', cleanEmail(form.email)],
        [ar ? 'اسم المنشأة بالحساب' : 'Display organization', form.establishmentDisplayName],
        [ar ? 'الاسم التجاري / القانوني' : 'Legal / trade name', form.legalName],
        [ar ? 'الرقم الموحد' : 'Unified commercial number', form.commercialNumber],
        [ar ? 'الرقم الضريبي' : 'VAT number', form.vatRegistered ? form.vatNumber : (ar ? 'غير مسجل' : 'Not registered')],
      ]
    : [
        [ar ? 'نوع الحساب' : 'Account type', ar ? 'فردي' : 'Individual'],
        [ar ? 'الاسم الكامل' : 'Full name', form.fullName],
        [ar ? 'اسم المستخدم' : 'Username', form.username],
        [ar ? 'الجوال' : 'Mobile', normalizeSaudiPhone(form.phone)],
        [ar ? 'البريد الإلكتروني' : 'Email', cleanEmail(form.email)],
        [ar ? 'تاريخ الميلاد' : 'Birth date', form.birthDate],
        [ar ? 'الجنس' : 'Gender', form.gender === 'male' ? (ar ? 'ذكر' : 'Male') : form.gender === 'female' ? (ar ? 'أنثى' : 'Female') : (ar ? 'أفضل عدم التحديد' : 'Prefer not to say')],
      ];

  const addressSummary = `${form.buildingNumber} ${form.street}، ${form.district}، ${form.city} ${form.postalCode}`;

  if (completed) {
    return <section className="page-section shell signup-page">
      <div className="signup-complete-card">
        <div className="signup-complete-icon"><CheckCircle2 size={42}/></div>
        <span>ACCOUNT CREATED</span>
        <h1>{ar ? 'بقيت خطوة واحدة.' : 'One step remains.'}</h1>
        <p>{ar ? `أرسلنا رابط التفعيل إلى ${cleanEmail(form.email)}. بعد تأكيد البريد يمكنك تسجيل الدخول مباشرة.` : `We sent an activation link to ${cleanEmail(form.email)}. After confirming your email, you can sign in.`}</p>
        <Link className="btn primary" to={accountPath}>{ar ? 'الانتقال إلى تسجيل الدخول' : 'Go to sign in'}<ArrowRight size={17}/></Link>
      </div>
    </section>;
  }

  return <section className="page-section shell signup-page">
    <div className="signup-frame">
      <aside className="signup-aside">
        <div>
          <span className="eyebrow">BALQEES CLIENT PORTAL</span>
          <h1>{ar ? 'إنشاء حساب بلقيس' : 'Create your Balqees account'}</h1>
          <p>{ar ? 'ابدأ باختيار نوع الحساب.' : 'Start by choosing your account type.'}</p>
        </div>
        <div className="signup-trust-list">
          <span><ShieldCheck size={17}/>{ar ? 'بيانات آمنة' : 'Secure data'}</span>
          <span><MapPin size={17}/>{ar ? 'العنوان الوطني' : 'National Address'}</span>
        </div>
        <div className="signup-aside-note"><Sparkles size={16}/>{ar ? 'بلقيس الورد · مكة المكرمة' : 'BALQEES FLORAL · MAKKAH'}</div>
      </aside>

      <main className="signup-main">
        <div className="signup-topline">
          <Link to={accountPath} className="signup-login-link"><ArrowLeft size={16}/>{ar ? 'لدي حساب' : 'I have an account'}</Link>
          <span>{ar ? 'إنشاء حساب جديد' : 'CREATE ACCOUNT'}</span>
        </div>

        {!hasAccountType ? <div className="signup-account-choice signup-stage">
          <div className="signup-choice-intro">
            <span>{ar ? 'ابدأ من هنا' : 'START HERE'}</span>
            <h2>{ar ? 'اختر نوع الحساب' : 'Choose account type'}</h2>
          </div>

          <div className="signup-choice-list">
            <button type="button" className="signup-choice-card" onClick={() => setAccountType('individual')}>
              <span className="signup-choice-icon"><UserRound size={26}/></span>
              <span className="signup-choice-copy">
                <strong>{ar ? 'حساب فردي' : 'Individual account'}</strong>
                <small>{ar ? 'للعملاء الأفراد.' : 'For individuals.'}</small>
              </span>
              <span className="signup-choice-arrow"><NextIcon size={20}/></span>
            </button>

            <button type="button" className="signup-choice-card featured" onClick={() => setAccountType('company')}>
              <span className="signup-choice-icon"><Building2 size={26}/></span>
              <span className="signup-choice-copy">
                <span className="signup-choice-tag">{ar ? 'للجهات والأعمال' : 'FOR BUSINESS'}</span>
                <strong>{ar ? 'حساب منشأة' : 'Organization account'}</strong>
                <small>{ar ? 'للشركات والمنشآت.' : 'For organizations.'}</small>
              </span>
              <span className="signup-choice-arrow"><NextIcon size={20}/></span>
            </button>
          </div>


        </div> : <>
          <div className="signup-selected-type">
            <span className="signup-selected-type-main">
              {isCompany ? <Building2 size={17}/> : <UserRound size={17}/>}
              <span>
                <small>{ar ? 'نوع الحساب' : 'ACCOUNT TYPE'}</small>
                <strong>{isCompany ? (ar ? 'منشأة' : 'Organization') : (ar ? 'فردي' : 'Individual')}</strong>
              </span>
            </span>
            <button type="button" onClick={resetAccountType}>{ar ? 'تغيير النوع' : 'Change type'}</button>
          </div>

        <div className={`signup-stepper steps-${totalSteps}`} aria-label={ar ? 'مراحل التسجيل' : 'Registration steps'}>
          {steps.map((label, index) => {
            const number = index + 1;
            return <button key={label} type="button" className={`${step === number ? 'active' : ''} ${step > number ? 'done' : ''}`} onClick={() => number < step && setStep(number)}>
              <i>{step > number ? <Check size={14}/> : number}</i><span>{label}</span>
            </button>;
          })}
        </div>

        {step === 1 && <div className="signup-stage">
          <div className="signup-stage-heading"><span>{ar ? `المرحلة 1 من ${totalSteps}` : `STEP 1 OF ${totalSteps}`}</span><h2>{isCompany ? (ar ? 'بيانات الحساب والمسؤول' : 'Account & contact details') : (ar ? 'بياناتك الشخصية' : 'Your personal details')}</h2><p>{ar ? 'هذه البيانات تستخدم للدخول والتواصل معك بخصوص الخدمة.' : 'These details are used for sign-in and service communication.'}</p></div>
          <div className="signup-grid two">
            <Field label={ar ? 'الاسم الكامل' : 'Full name'} icon={<UserRound size={18}/>} error={errors.fullName}><input className={inputClass('fullName')} value={form.fullName} onChange={e => update('fullName', e.target.value)} autoComplete="name" placeholder={ar ? 'الاسم كما تفضّل ظهوره' : 'Your full name'}/></Field>
            <Field label={ar ? 'اسم المستخدم' : 'Username'} icon={<BadgeCheck size={18}/>} error={errors.username}><input className={inputClass('username')} value={form.username} onChange={e => update('username', e.target.value)} autoCapitalize="none" spellCheck="false" dir="ltr" placeholder="balqees_client"/></Field>
            <Field label={ar ? 'رقم الجوال' : 'Mobile number'} icon={<Phone size={18}/>} error={errors.phone}><input className={inputClass('phone')} value={form.phone} onChange={e => update('phone', e.target.value)} type="tel" inputMode="tel" dir="ltr" autoComplete="tel" placeholder="05xxxxxxxx"/></Field>
            <Field label={ar ? 'البريد الإلكتروني' : 'Email'} icon={<Mail size={18}/>} error={errors.email}><input className={inputClass('email')} value={form.email} onChange={e => update('email', e.target.value)} type="email" inputMode="email" dir="ltr" autoComplete="email" placeholder="name@company.com"/></Field>
          </div>
          {isCompany && <Field label={ar ? 'اسم المنشأة في الحساب' : 'Organization display name'} icon={<Building2 size={18}/>} error={errors.establishmentDisplayName} hint={ar ? 'اسم مختصر يظهر داخل بوابة العميل؛ يمكن أن يكون اسم الشركة أو الفندق أو المؤسسة.' : 'A short name displayed inside the client portal.'}><input className={inputClass('establishmentDisplayName')} value={form.establishmentDisplayName} onChange={e => update('establishmentDisplayName', e.target.value)} autoComplete="organization" placeholder={ar ? 'مثال: شركة النخبة للضيافة' : 'Example: Elite Hospitality Co.'}/></Field>}
          {!isCompany && <div className="signup-grid two">
            <Field label={ar ? 'تاريخ الميلاد' : 'Birth date'} icon={<CircleHelp size={18}/>} error={errors.birthDate}><input className={inputClass('birthDate')} value={form.birthDate} onChange={e => update('birthDate', e.target.value)} type="date"/></Field>
            <Field label={ar ? 'الجنس' : 'Gender'} icon={<UserRound size={18}/>} error={errors.gender}><select className={inputClass('gender')} value={form.gender} onChange={e => update('gender', e.target.value)}><option value="">{ar ? 'اختر' : 'Select'}</option><option value="male">{ar ? 'ذكر' : 'Male'}</option><option value="female">{ar ? 'أنثى' : 'Female'}</option><option value="prefer_not_to_say">{ar ? 'أفضل عدم التحديد' : 'Prefer not to say'}</option></select></Field>
          </div>}
          <div className="signup-grid two">
            <Field label={ar ? 'كلمة المرور' : 'Password'} icon={<LockKeyhole size={18}/>} error={errors.password}><div className="password-field"><input className={inputClass('password')} value={form.password} onChange={e => update('password', e.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••"/><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={ar ? 'إظهار أو إخفاء كلمة المرور' : 'Show or hide password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></Field>
            <Field label={ar ? 'تأكيد كلمة المرور' : 'Confirm password'} icon={<KeyRound size={18}/>} error={errors.confirmPassword}><input className={inputClass('confirmPassword')} value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••"/></Field>
          </div>
          <div className="signup-password-meter"><div>{[1,2,3,4].map(n => <span key={n} className={score >= n ? 'filled' : ''}/>)}</div><small>{ar ? (score < 2 ? 'استخدم حروفًا وأرقامًا، ويفضل رمزًا إضافيًا.' : score < 4 ? 'جيدة، ويمكن جعلها أقوى.' : 'كلمة مرور قوية.') : (score < 2 ? 'Use letters, numbers and preferably a symbol.' : score < 4 ? 'Good; it can be stronger.' : 'Strong password.')}</small></div>
        </div>}

        {isCompany && step === 2 && <div className="signup-stage">
          <div className="signup-stage-heading"><span>{ar ? 'المرحلة 2 من 4' : 'STEP 2 OF 4'}</span><h2>{ar ? 'بيانات المنشأة' : 'Organization details'}</h2><p>{ar ? 'نجمع فقط بيانات العمل العامة اللازمة للتعامل التجاري والخدمة.' : 'Only general business data needed for commercial service is collected.'}</p></div>
          <Field label={ar ? 'الاسم التجاري أو القانوني' : 'Legal or trade name'} icon={<Landmark size={18}/>} error={errors.legalName}><input className={inputClass('legalName')} value={form.legalName} onChange={e => update('legalName', e.target.value)} autoComplete="organization" placeholder={ar ? 'الاسم كما يظهر في السجل' : 'Name as shown in the commercial record'}/></Field>
          <div className="signup-grid two">
            <Field label={ar ? 'نوع المنشأة' : 'Organization type'} icon={<Building2 size={18}/>} error={errors.entityType}><select className={inputClass('entityType')} value={form.entityType} onChange={e => update('entityType', e.target.value)}><option value="company">{ar ? 'شركة' : 'Company'}</option><option value="establishment">{ar ? 'مؤسسة' : 'Establishment'}</option><option value="hotel">{ar ? 'فندق / ضيافة' : 'Hotel / Hospitality'}</option><option value="restaurant">{ar ? 'مطعم / مقهى' : 'Restaurant / Cafe'}</option><option value="government">{ar ? 'جهة حكومية' : 'Government entity'}</option><option value="healthcare">{ar ? 'قطاع صحي' : 'Healthcare'}</option><option value="events">{ar ? 'فعاليات ومناسبات' : 'Events'}</option><option value="other">{ar ? 'منشأة أخرى' : 'Other organization'}</option></select></Field>
            <Field label={ar ? 'صفة مسؤول الحساب (اختياري)' : 'Account contact role (optional)'} icon={<UserRound size={18}/>}><input className="signup-input" value={form.contactRole} onChange={e => update('contactRole', e.target.value)} placeholder={ar ? 'مثال: المشتريات، الإدارة، المرافق' : 'e.g. Procurement, Admin, Facilities'}/></Field>
          </div>
          <div className="signup-grid two">
            <Field label={ar ? 'الرقم الموحد للسجل التجاري' : 'Unified commercial number'} icon={<FileCheck2 size={18}/>} error={errors.commercialNumber} hint={ar ? 'وفق نظام السجل التجاري الحالي: 10 أرقام ويبدأ بـ 7.' : 'Current Saudi commercial register format: 10 digits beginning with 7.'}><input className={inputClass('commercialNumber')} value={form.commercialNumber} onChange={e => update('commercialNumber', e.target.value.replace(/\D/g, '').slice(0,10))} inputMode="numeric" dir="ltr" placeholder="7xxxxxxxxx"/><a className="official-check-link" href="https://mc.gov.sa/ar/eservices/Pages/Commercial-data.aspx" target="_blank" rel="noreferrer">{ar ? 'التحقق الرسمي لدى وزارة التجارة' : 'Official Ministry verification'}</a></Field>
            <Field label={ar ? 'الموقع الإلكتروني (اختياري)' : 'Website (optional)'} icon={<Globe2 size={18}/>} error={errors.website}><input className={inputClass('website')} value={form.website} onChange={e => update('website', e.target.value)} type="url" dir="ltr" placeholder="https://example.com"/></Field>
          </div>
          <label className="signup-toggle"><input type="checkbox" checked={form.vatRegistered} onChange={e => update('vatRegistered', e.target.checked)}/><span><strong>{ar ? 'المنشأة مسجلة في ضريبة القيمة المضافة' : 'Organization is VAT registered'}</strong><small>{ar ? 'ألغِ الاختيار إذا لم تكن المنشأة مسجلة.' : 'Turn this off if the organization is not VAT registered.'}</small></span></label>
          {form.vatRegistered && <Field label={ar ? 'الرقم الضريبي' : 'VAT registration number'} icon={<BadgeCheck size={18}/>} error={errors.vatNumber} hint={ar ? '15 رقمًا، يبدأ وينتهي بالرقم 3.' : '15 digits, starting and ending with 3.'}><input className={inputClass('vatNumber')} value={form.vatNumber} onChange={e => update('vatNumber', e.target.value.replace(/\D/g, '').slice(0,15))} inputMode="numeric" dir="ltr" placeholder="3xxxxxxxxxxxxx3"/><a className="official-check-link" href="https://zatca.gov.sa/ar/eServices/Pages/eServices-007.aspx" target="_blank" rel="noreferrer">{ar ? 'التحقق الرسمي لدى هيئة الزكاة والضريبة والجمارك' : 'Official ZATCA verification'}</a></Field>}
          <div className="signup-official-note"><ShieldCheck size={17}/><p>{ar ? 'النظام يمنع الصيغ غير الصحيحة مباشرة. التحقق من وجود السجل أو حالة التسجيل رسميًا يحتاج خدمة تحقق حكومية؛ لذلك أضفنا روابط التحقق الرسمية بدل الاعتماد على تخمين من الموقع.' : 'The form blocks invalid formats immediately. Confirming that a record actually exists requires an official government verification service, so official verification links are provided rather than guessing.'}</p></div>
        </div>}

        {((isCompany && step === 3) || (!isCompany && step === 2)) && <div className="signup-stage">
          <div className="signup-stage-heading"><span>{isCompany ? (ar ? 'المرحلة 3 من 4' : 'STEP 3 OF 4') : (ar ? 'المرحلة 2 من 3' : 'STEP 2 OF 3')}</span><h2>{ar ? 'العنوان الوطني' : 'National Address'}</h2><p>{ar ? 'الحقول الأساسية مطابقة لمكوّنات العنوان الوطني في سبل.' : 'Core fields follow the Saudi National Address components.'}</p></div>
          <div className="signup-grid two">
            <Field label={ar ? 'المدينة' : 'City'} icon={<MapPin size={18}/>} error={errors.city}><input className={inputClass('city')} value={form.city} onChange={e => update('city', e.target.value)} autoComplete="address-level2"/></Field>
            <Field label={ar ? 'الحي' : 'District'} icon={<MapPin size={18}/>} error={errors.district}><input className={inputClass('district')} value={form.district} onChange={e => update('district', e.target.value)} autoComplete="address-level3"/></Field>
            <Field label={ar ? 'الشارع' : 'Street'} icon={<MapPin size={18}/>} error={errors.street}><input className={inputClass('street')} value={form.street} onChange={e => update('street', e.target.value)} autoComplete="street-address"/></Field>
            <Field label={ar ? 'رقم المبنى' : 'Building number'} icon={<Building2 size={18}/>} error={errors.buildingNumber} hint={ar ? '4 أرقام' : '4 digits'}><input className={inputClass('buildingNumber')} value={form.buildingNumber} onChange={e => update('buildingNumber', e.target.value.replace(/\D/g, '').slice(0,4))} inputMode="numeric" dir="ltr" placeholder="2929"/></Field>
            <Field label={ar ? 'الرقم الفرعي' : 'Secondary number'} icon={<MapPin size={18}/>} error={errors.secondaryNumber} hint={ar ? '4 أرقام' : '4 digits'}><input className={inputClass('secondaryNumber')} value={form.secondaryNumber} onChange={e => update('secondaryNumber', e.target.value.replace(/\D/g, '').slice(0,4))} inputMode="numeric" dir="ltr" placeholder="8118"/></Field>
            <Field label={ar ? 'الرمز البريدي' : 'Postal code'} icon={<MapPin size={18}/>} error={errors.postalCode} hint={ar ? '5 أرقام' : '5 digits'}><input className={inputClass('postalCode')} value={form.postalCode} onChange={e => update('postalCode', e.target.value.replace(/\D/g, '').slice(0,5))} inputMode="numeric" dir="ltr" placeholder="13337"/></Field>
            <Field label={ar ? 'رقم الوحدة (اختياري)' : 'Unit number (optional)'} icon={<Building2 size={18}/>}><input className="signup-input" value={form.unitNumber} onChange={e => update('unitNumber', e.target.value.replace(/\D/g, '').slice(0,6))} inputMode="numeric" dir="ltr"/></Field>
            <Field label={ar ? 'العنوان المختصر (اختياري)' : 'Short address (optional)'} icon={<BadgeCheck size={18}/>} error={errors.shortAddress} hint={ar ? '4 أحرف + 4 أرقام' : '4 letters + 4 digits'}><input className={inputClass('shortAddress')} value={form.shortAddress} onChange={e => update('shortAddress', e.target.value.toUpperCase().replace(/\s/g, '').slice(0,8))} dir="ltr" placeholder="RHMA3184"/></Field>
          </div>
          <div className="signup-map-panel">
            <div><span><LocateFixed size={21}/></span><div><strong>{ar ? 'تحديد الموقع بسهولة' : 'Easy location pin'}</strong><p>{ar ? 'يمكنك السماح للمتصفح بالتقاط موقعك الحالي، أو لصق رابط الموقع من Google Maps. هذا لا يغني عن كتابة العنوان الوطني.' : 'Allow the browser to capture your current location, or paste a Google Maps link. This does not replace the National Address fields.'}</p></div></div>
            <button type="button" className="btn ghost" onClick={useCurrentLocation} disabled={locating}><LocateFixed size={17}/>{locating ? (ar ? 'جاري تحديد الموقع…' : 'Locating…') : (ar ? 'استخدم موقعي الحالي' : 'Use current location')}</button>
          </div>
          <Field label={ar ? 'رابط Google Maps (اختياري)' : 'Google Maps link (optional)'} icon={<MapPin size={18}/>}><input className="signup-input" value={form.mapsUrl} onChange={e => update('mapsUrl', e.target.value)} type="url" dir="ltr" placeholder="https://maps.google.com/..."/></Field>
          {form.latitude && form.longitude && <div className="signup-location-captured"><CheckCircle2 size={16}/><span>{ar ? 'تم حفظ الإحداثيات' : 'Coordinates saved'}: <b dir="ltr">{form.latitude}, {form.longitude}</b>{form.mapsUrl && <a href={form.mapsUrl} target="_blank" rel="noreferrer">{ar ? 'فتح في Google Maps' : 'Open in Google Maps'}</a>}</span></div>}
          {message && <Message message={message}/>} 
        </div>}

        {step === totalSteps && <div className="signup-stage signup-review-stage">
          <div className="signup-stage-heading"><span>{ar ? `المرحلة ${totalSteps} من ${totalSteps}` : `STEP ${totalSteps} OF ${totalSteps}`}</span><h2>{ar ? 'راجع بياناتك قبل إنشاء الحساب' : 'Review before creating the account'}</h2><p>{ar ? 'يمكنك العودة لأي مرحلة وتعديل البيانات قبل الإرسال.' : 'You can return to any previous stage before submitting.'}</p></div>
          <ReviewCard title={ar ? 'بيانات الحساب' : 'Account details'} rows={reviewRows} onEdit={() => setStep(1)} editText={ar ? 'تعديل' : 'Edit'}/>
          {isCompany && <ReviewCard title={ar ? 'بيانات المنشأة' : 'Organization'} rows={[[ar ? 'نوع المنشأة' : 'Organization type', form.entityType],[ar ? 'صفة مسؤول الحساب' : 'Contact role', form.contactRole || '—'],[ar ? 'الموقع الإلكتروني' : 'Website', form.website || '—']]} onEdit={() => setStep(2)} editText={ar ? 'تعديل' : 'Edit'}/>} 
          <ReviewCard title={ar ? 'العنوان' : 'Address'} rows={[[ar ? 'العنوان الوطني' : 'National address', addressSummary],[ar ? 'العنوان المختصر' : 'Short address', form.shortAddress || '—'],[ar ? 'موقع Google Maps' : 'Google Maps', form.mapsUrl ? (ar ? 'مضاف' : 'Added') : '—']]} onEdit={() => setStep(isCompany ? 3 : 2)} editText={ar ? 'تعديل' : 'Edit'}/>
          <label className={`signup-consent ${errors.consent ? 'invalid' : ''}`}><input type="checkbox" checked={form.consent} onChange={e => update('consent', e.target.checked)}/><span><strong>{ar ? 'أؤكد أن البيانات صحيحة' : 'I confirm the information is correct'}</strong><small>{ar ? 'وأوافق على استخدامها لإنشاء الحساب والتواصل المتعلق بخدمات بلقيس.' : 'and consent to its use for account creation and Balqees service communications.'}</small></span></label>
          {errors.consent && <small className="field-error standalone">{errors.consent}</small>}
          {message && <Message message={message}/>} 
        </div>}

        <div className="signup-navigation">
          <button type="button" className="btn ghost" onClick={previousStep} disabled={loading}><PrevIcon size={17}/>{step === 1 ? (ar ? 'نوع الحساب' : 'Account type') : (ar ? 'السابق' : 'Back')}</button>
          {step < totalSteps ? <button type="button" className="btn primary" onClick={nextStep}>{ar ? 'التالي' : 'Continue'}<NextIcon size={17}/></button> : <button type="button" className="btn primary signup-final-submit" onClick={submitSignup} disabled={loading}>{loading ? (ar ? 'جاري إنشاء الحساب…' : 'Creating account…') : (ar ? 'إنشاء الحساب' : 'Create account')}<CheckCircle2 size={18}/></button>}
        </div>
        </>}
        {!isSupabaseConfigured && <div className="auth-config-note"><ShieldCheck size={16}/><span>{ar ? 'التصميم والتحقق جاهزان. لتفعيل الإنشاء الفعلي على الاستضافة أضف متغيرات Supabase ثم طبّق ملف قاعدة البيانات المرفق.' : 'The flow and validation are ready. Add Supabase environment variables and apply the included database setup to activate live accounts.'}</span></div>}
      </main>
    </div>
  </section>;
}

function Field({ label, icon, error, hint, children }) {
  return <label className="signup-field"><span className="signup-field-label">{label}{hint && <small>{hint}</small>}</span><div className={error ? 'signup-control invalid' : 'signup-control'}>{icon}{children}</div>{error && <small className="field-error">{error}</small>}</label>;
}

function Message({ message }) {
  return <div className={`auth-message ${message.type}`}>{message.type === 'success' ? <CheckCircle2 size={17}/> : <ShieldCheck size={17}/>}<span>{message.text}</span></div>;
}

function ReviewCard({ title, rows, onEdit, editText }) {
  return <section className="signup-review-card"><header><h3>{title}</h3><button type="button" onClick={onEdit}>{editText}</button></header><div>{rows.map(([label, value]) => <p key={label}><span>{label}</span><strong dir={/email|username|number|VAT|Google|مستخدم|رقم|ضريبي/i.test(label) ? 'ltr' : undefined}>{value || '—'}</strong></p>)}</div></section>;
}
