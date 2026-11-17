import { useState, useEffect } from 'react'
import {
  Activity, ArrowLeft, ArrowUpLeft, CheckCircle2, Moon, Sun,
  ChevronLeft, Clock3, HeartPulse, Hospital, Menu, Search,
  ShieldCheck, Stethoscope, UserRound, Users, X, LogOut
} from 'lucide-react'
import './index.css'
import DoctorDashboard from './DoctorDashboard'
import AdminDashboard from './AdminDashboard'
import DoctorBooking from './DoctorBooking'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'

const specialtyIcons: Record<string, string> = {
  'قلب و عروق': '❤️',
  'پوست و مو': '✨',
  'مغز و اعصاب': '🧠',
  'ارتوپدی': '🦴',
  'کودکان': '👶',
  'چشم پزشکی': '👁️',
}

type PublicDoctor = {
  doctorId: string
  firstName: string
  lastName: string
  biography: string | null
  yearsExperience: number
  specialties: { id: string; name: string; description: string | null }[]
}

type Mode = 'login' | 'register'

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('hadimed_theme')
    return saved === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('hadimed_theme', theme)
  }, [theme])
  const [mode, setMode] = useState<Mode>('login')
  const [modal, setModal] = useState(false)
  const [menu, setMenu] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [doctors, setDoctors] = useState<PublicDoctor[]>([])
  const [doctorsLoading, setDoctorsLoading] = useState(true)
  const [doctorsError, setDoctorsError] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState('')
  const [bookingDoctor, setBookingDoctor] = useState<PublicDoctor | null>(null)
  type AppUser = { id?: string; email: string; role: 'PATIENT' | 'DOCTOR' | 'ADMIN'; firstName?: string; lastName?: string; status?: string }

  const [user, setUser] = useState<AppUser | null>(null)
  const [form, setForm] = useState({
    firstName: '', lastName: '', identifier: '', password: '', role: 'PATIENT', licenseNumber: ''
  })

  useEffect(() => {
    let active = true
    const loadDoctors = async () => {
      try {
        const response = await fetch(`${API}/doctors`)
        if (!response.ok) throw new Error('دریافت فهرست پزشکان ناموفق بود.')
        const result = await response.json()
        const data = result.data ?? result.value ?? result
        if (!Array.isArray(data)) throw new Error('ساختار پاسخ فهرست پزشکان معتبر نیست.')
        if (active) setDoctors(data as PublicDoctor[])
      } catch (err) {
        if (active) setDoctorsError(err instanceof Error ? err.message : 'خطا در دریافت پزشکان')
      } finally {
        if (active) setDoctorsLoading(false)
      }
    }
    void loadDoctors()
    return () => { active = false }
  }, [])
  useEffect(() => {
    let active = true
    const restoreSession = async () => {
      const refreshToken = sessionStorage.getItem('hadimed_refresh_token')
      let token = sessionStorage.getItem('hadimed_token')
      if (!token && !refreshToken) return
      try {
        let currentUser: any = null
        if (token) {
          const response = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
          if (response.ok) {
            const result = await response.json()
            currentUser = result.data ?? result
          }
        }
        if (!currentUser && refreshToken) {
          const response = await fetch(`${API}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          })
          if (!response.ok) { if (response.status === 401 || response.status === 403) throw new Error('Session expired'); throw new Error('Temporary authentication service error') }
          const result = await response.json()
          const data = result.data ?? result
          if (!data.accessToken || !data.refreshToken || !data.user) throw new Error('Invalid refresh response')
          token = data.accessToken
          sessionStorage.setItem('hadimed_token', data.accessToken)
      if (data.refreshToken) sessionStorage.setItem('hadimed_refresh_token', data.refreshToken)
          currentUser = data.user
        }
        if (!currentUser?.email) throw new Error('Invalid user response')
        if (active) setUser({
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.role,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          status: currentUser.status,
        })
      } catch (error) {
        const temporaryFailure = error instanceof TypeError || (error instanceof Error && error.message === 'Temporary authentication service error')
        if (!temporaryFailure) {
          sessionStorage.removeItem('hadimed_token')
          sessionStorage.removeItem('hadimed_refresh_token')
        }
        if (active) setUser(null)
      }
    }
    void restoreSession()
    return () => { active = false }
  }, [])
  const openAuth = (next: Mode) => {
    setMode(next)
    setNotice('')
    setError('')
    setModal(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')

    try {
      const isRegister = mode === 'register'
      const response = await fetch(
        `${API}/auth/${isRegister ? 'register' : 'login'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isRegister
              ? {
                  email: form.identifier.trim().toLowerCase(),
                  password: form.password,
                  firstName: form.firstName.trim(),
                  lastName: form.lastName.trim(),
                  role: form.role,
                  licenseNumber: form.role === 'DOCTOR'
                    ? form.licenseNumber.trim()
                    : undefined,
                }
              : {
                  identifier: form.identifier.trim(),
                  password: form.password,
                }
          ),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          Array.isArray(result.message)
            ? result.message.join('، ')
            : result.message || 'درخواست ناموفق بود'
        )
      }

      const data = result.data ?? result

      if (!data.user) {
        throw new Error('Invalid authentication response.')
      }

      if (isRegister && data.pendingVerification) {
        setModal(false)
        setNotice('درخواست ثبت‌نام پزشک دریافت شد. پس از تأیید مدارک می‌توانید وارد شوید.')
        return
      }

      if (!data.accessToken) {
        throw new Error('Authentication token is missing.')
      }

      sessionStorage.setItem('hadimed_token', data.accessToken)
      if (data.refreshToken) sessionStorage.setItem('hadimed_refresh_token', data.refreshToken)
      setUser({ id: data.user.id, email: data.user.email || form.identifier, role: data.user.role, firstName: data.user.firstName, lastName: data.user.lastName, status: data.user.status })
      setModal(false)
      setNotice(
        isRegister
          ? 'ثبت‌نام با موفقیت انجام شد. به HadiMed خوش آمدید.'
          : 'با موفقیت وارد حساب کاربری شدید.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ارتباط با سرور')
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    const refreshToken = sessionStorage.getItem('hadimed_refresh_token')
    const token = sessionStorage.getItem('hadimed_token')
    try {
      if (refreshToken) {
        await fetch(`${API}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
      } else if (token) {
        await fetch(`${API}/auth/logout-all`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } finally {
      sessionStorage.removeItem('hadimed_token')
      sessionStorage.removeItem('hadimed_refresh_token')
      setUser(null)
    }
  }

  const specialties = Array.from(
    new Set(doctors.flatMap((doctor) => doctor.specialties.map((item) => item.name)))
  ).map((name) => ({
    name,
    icon: specialtyIcons[name] || '🩺',
    count: `${doctors.filter((doctor) => doctor.specialties.some((item) => item.name === name)).length.toLocaleString('fa-IR')} پزشک`,
  }))
  const filtered = specialties.filter((item) => item.name.includes(search.trim()))
  const visibleDoctors = selectedSpecialty
    ? doctors.filter((doctor) => doctor.specialties.some((item) => item.name === selectedSpecialty))
    : []

  return (
    <div className="app" dir="rtl">
      <header className="header">
        <div className="container nav">
          <a className="brand" href="#">
            <span className="brand-icon"><HeartPulse size={25} /></span>
            <span>Hadi<span className="brand-light">Med</span><small>سلامت هوشمند، زندگی بهتر</small></span>
          </a>

          <nav className={menu ? 'nav-links open' : 'nav-links'}>
            <a href="#home" onClick={() => setMenu(false)}>خانه</a>
            <a href="#services" onClick={() => setMenu(false)}>خدمات</a>
            <a href="#specialties" onClick={() => setMenu(false)}>تخصص‌ها</a>
            <a href="#about" onClick={() => setMenu(false)}>درباره ما</a>
          </nav>

          <div className="nav-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme(current => current === 'light' ? 'dark' : 'light')}
              aria-label={theme === 'light' ? 'فعال‌کردن تم تیره' : 'فعال‌کردن تم روشن'}
              title={theme === 'light' ? 'تم تیره' : 'تم روشن'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              <span>{theme === 'light' ? 'حالت تیره' : 'حالت روشن'}</span>
            </button>
            {user ? (
              <>
                <span className="user-label"><UserRound size={17} /> {user.email}</span>
                <button className="btn btn-outline btn-small" onClick={logout}><LogOut size={16} /> خروج</button>
              </>
            ) : (
              <>
                <button className="login-link" onClick={() => openAuth('login')}>ورود</button>
                <button className="btn btn-primary btn-small" onClick={() => openAuth('register')}>ثبت‌نام <ArrowLeft size={16} /></button>
              </>
            )}
          </div>
          <button className="menu-toggle" onClick={() => setMenu(!menu)} aria-label="منو">
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {user?.role === 'ADMIN' ? <AdminDashboard /> : user?.role === 'DOCTOR' ? <DoctorDashboard /> : <main>
        <section className="hero" id="home">
          <div className="container hero-grid">
            <div className="hero-content">
              <div className="eyebrow"><span className="pulse" /> همراه مطمئن شما در مسیر سلامتی</div>
              <h1>سلامتی شما،<br /><span>اولویت همیشگی ماست.</span></h1>
              <p className="hero-desc">
                در HadiMed دسترسی به خدمات پزشکی، پزشکان متخصص و مراقبت‌های سلامت آسان‌تر از همیشه است.
                با اطمینان، آگاهانه و سریع‌تر برای سلامتی خود تصمیم بگیرید.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary btn-large" onClick={() => openAuth('register')}>
                  شروع کنید <ArrowLeft size={18} />
                </button>
                <a className="text-link" href="#specialties">مشاهده تخصص‌ها <ChevronLeft size={17} /></a>
              </div>
              <div className="trust-row">
                <div className="trust-icon"><ShieldCheck size={20} /></div>
                <div><b>حریم خصوصی و امنیت</b><small>اطلاعات شما با دقت محافظت می‌شود</small></div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="visual-glow" />
              <div className="medical-card main-card">
                <div className="card-top"><span className="online-dot" /> پلتفرم سلامت HadiMed</div>
                <div className="medical-symbol"><Activity size={76} strokeWidth={1.5} /></div>
                <h3>مراقبت هوشمندانه</h3>
                <p>یک قدم نزدیک‌تر به زندگی سالم‌تر</p>
                <div className="card-divider" />
                <div className="mini-features">
                  <span><CheckCircle2 size={16} /> دسترسی آسان</span>
                  <span><CheckCircle2 size={16} /> تجربه امن</span>
                </div>
              </div>
              <div className="float-card float-one"><span className="float-icon"><Stethoscope /></span><div><b>خدمات تخصصی</b><small>در یک مسیر ساده</small></div></div>
              <div className="float-card float-two"><span className="float-icon green"><HeartPulse /></span><div><b>سلامت مهم است</b><small>هر روز، هر لحظه</small></div></div>
              <div className="decor decor-one" /><div className="decor decor-two" />
            </div>
          </div>
        </section>

        <section className="stats container">
          <div className="stat"><span><Users /></span><div><b>تجربه بهتر</b><small>برای بیماران و پزشکان</small></div></div>
          <div className="stat"><span><Hospital /></span><div><b>خدمات یکپارچه</b><small>در یک پلتفرم</small></div></div>
          <div className="stat"><span><ShieldCheck /></span><div><b>امنیت اطلاعات</b><small>با اولویت حریم خصوصی</small></div></div>
          <div className="stat"><span><Clock3 /></span><div><b>دسترسی آسان</b><small>در هر زمان و مکان</small></div></div>
        </section>

        <section className="section services" id="services">
          <div className="container">
            <div className="section-heading">
              <span className="section-kicker">خدمات HadiMed</span>
              <h2>خدمات سلامت دیجیتال HadiMed</h2>
              <p>ابزارهای موردنیاز برای مدیریت بهتر سلامت</p>
              <article className="service-card">
                <div className="service-icon violet"><ShieldCheck /></div>
                <h3>حساب کاربری امن</h3>
                <p>ورود امن و دسترسی متناسب با نقش کاربری شما.</p>
                <button onClick={() => openAuth('login')}>ورود به حساب <ArrowUpLeft size={16} /></button>
              </article>
            </div>
          </div>
        </section>

        <section className="section specialty-section" id="specialties">
          <div className="container">
            <div className="section-heading heading-row">
              <div><span className="section-kicker">حوزه‌های پزشکی</span><h2>تخصص‌های <span>پزشکی</span></h2><p>حوزه مورد نظر خود را جست‌وجو کنید.</p></div>
              <div className="search-box"><Search size={19} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جست‌وجوی تخصص..." /></div>
            </div>
            <div className="specialty-grid">
              {filtered.map(item => (
                <button
                  className="specialty-card"
                  key={item.name}
                  onClick={() => setSelectedSpecialty(selectedSpecialty === item.name ? '' : item.name)}
                  aria-pressed={selectedSpecialty === item.name}
                >
                  <span className="specialty-emoji">{item.icon}</span>
                  <span className="specialty-info"><b>{item.name}</b><small>{item.count}</small></span>
                  <ChevronLeft size={19} className="specialty-arrow" />
                </button>
              ))}
              {!doctorsLoading && filtered.length === 0 && (
                <p className="empty">{search.trim() ? 'تخصصی با این نام پیدا نشد.' : 'در حال حاضر پزشک تأییدشده‌ای برای نمایش وجود ندارد.'}</p>
              )}
            </div>
            {doctorsLoading && <p className="empty">در حال دریافت فهرست پزشکان...</p>}
            {doctorsError && <p className="form-error">{doctorsError}</p>}
            {selectedSpecialty && (
              <div className="doctor-list">
                <div className="section-heading">
                  <h3>پزشکان تخصص {selectedSpecialty}</h3>
                  <button className="text-link" onClick={() => setSelectedSpecialty('')}>بستن</button>
                </div>
                {visibleDoctors.map(doctor => (
                  <article className="doctor-card" key={doctor.doctorId}>
                    <button type="button" className="btn btn-primary doctor-book-button" onClick={() => setBookingDoctor(doctor)}>دریافت نوبت</button>
                    <div className="doctor-info">
                      <b>دکتر {doctor.firstName} {doctor.lastName}</b>
                      <small>{doctor.yearsExperience.toLocaleString('fa-IR')} سال سابقه</small>
                      {doctor.biography && <p>{doctor.biography}</p>}
                    </div>
                  </article>
                ))}
                {visibleDoctors.length === 0 && <p className="empty">پزشکی در این تخصص یافت نشد.</p>}
              </div>
            )}
          </div>
        </section>

        <section className="cta-section" id="about">
          <div className="container cta">
            <div><span className="section-kicker">همین امروز شروع کنید</span><h2>برای سلامتی، یک قدم جلوتر باشید.</h2><p>به خانواده HadiMed بپیوندید و تجربه‌ای ساده‌تر از خدمات سلامت داشته باشید.</p></div>
            <button className="btn btn-white btn-large" onClick={() => openAuth('register')}>ساخت حساب کاربری <ArrowLeft size={18} /></button>
          </div>
        </section>
      </main>}

      <footer className="footer">
        <div className="container footer-inner">
          <a className="brand footer-brand" href="#"><span className="brand-icon"><HeartPulse size={23} /></span><span>Hadi<span className="brand-light">Med</span><small>سلامت هوشمند، زندگی بهتر</small></span></a>
          <p>HadiMed؛ همراه شما برای تجربه‌ای بهتر در مسیر سلامتی.</p>
          <span className="copyright">© 2026 HadiMed</span>
        </div>
      </footer>

      {bookingDoctor && (
        <DoctorBooking doctor={bookingDoctor} api={API} onClose={() => setBookingDoctor(null)} />
      )}
      {notice && <div className="toast"><CheckCircle2 size={19} />{notice}<button onClick={() => setNotice('')}><X size={16} /></button></div>}

      {modal && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="auth-modal">
            <button className="modal-close" onClick={() => setModal(false)}><X /></button>
            <div className="modal-logo"><HeartPulse size={28} /></div>
            <span className="section-kicker">به HadiMed خوش آمدید</span>
            <h2>{mode === 'login' ? 'ورود به حساب کاربری' : 'ایجاد حساب کاربری'}</h2>
            <p className="modal-desc">برای ادامه، اطلاعات خود را وارد کنید.</p>
            <div className="auth-tabs">
              <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setNotice('') }}>ورود</button>
              <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); setNotice('') }}>ثبت‌نام</button>
            </div>
            {notice && <div className="form-success">{notice}</div>}
            <form onSubmit={submit}>
              {mode === 'register' && <>
                <div className="form-row">
                  <label>نام<input required value={form.firstName} onChange={e => setForm({...form, firstName:e.target.value})} placeholder="نام شما" /></label>
                  <label>نام خانوادگی<input required value={form.lastName} onChange={e => setForm({...form, lastName:e.target.value})} placeholder="نام خانوادگی" /></label>
                </div>
                <label>نوع حساب<select value={form.role} onChange={e => setForm({...form, role:e.target.value})}><option value="PATIENT">بیمار</option><option value="DOCTOR">پزشک</option></select></label>
              {form.role === 'DOCTOR' && (
  <label>
    شماره نظام پزشکی
    <input
      type="text"
      required
      value={form.licenseNumber}
      onChange={e => setForm({ ...form, licenseNumber: e.target.value })}
      placeholder="شماره نظام پزشکی"
      dir="ltr"
    />
  </label>
)}
              </>}
              <label>ایمیل<input type={mode === 'register' ? 'email' : 'text'} required value={form.identifier} onChange={e => setForm({...form, identifier:e.target.value})} placeholder={mode === 'register' ? 'example@email.com' : 'ایمیل یا شماره تلفن'} dir="ltr" /></label>
              <label>رمز عبور<input type="password" required minLength={12} value={form.password} onChange={e => setForm({...form, password:e.target.value})} placeholder="حداقل ۱۲ کاراکتر" dir="ltr" /></label>
              {error && <div className="form-error">{error}</div>}
              <button className="btn btn-primary submit-btn" disabled={loading}>{loading ? 'لطفاً صبر کنید...' : mode === 'login' ? 'ورود به حساب' : 'ثبت‌نام'} <ArrowLeft size={18} /></button>
            </form>
            <small className="secure-note"><ShieldCheck size={15} /> اطلاعات شما با امنیت منتقل می‌شود.</small>
          </div>
        </div>
      )}
    </div>
  )
}
