import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, Check, X, RefreshCw, Search, ShieldCheck,
  Users, Clock3, UserRound, Mail, Phone, FileText,
  AlertCircle, CheckCircle2, XCircle
} from 'lucide-react'
import './AdminDashboard.css'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'

type VerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'

type AdminDoctor = {
  id: string
  userId: string
  licenseNumber: string
  biography: string | null
  yearsExperience: number
  verificationStatus: VerificationStatus
  rejectionReason: string | null
  createdAt: string
  reviewedAt: string | null
  user: {
    id: string
    email: string | null
    phone: string | null
    firstName: string
    lastName: string
    status: string
  }
}

type FilterStatus = 'ALL' | VerificationStatus

function getErrorMessage(result: any): string {
  if (Array.isArray(result?.message)) return result.message.join('، ')
  if (typeof result?.message === 'string') return result.message
  return 'ارتباط با سرور برقرار نشد.'
}

const statusLabels: Record<VerificationStatus, string> = {
  PENDING: 'در انتظار بررسی',
  UNDER_REVIEW: 'در حال بررسی',
  APPROVED: 'تأیید شده',
  REJECTED: 'رد شده',
}

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState<AdminDoctor[]>([])
  const [filter, setFilter] = useState<FilterStatus>('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rejectTarget, setRejectTarget] = useState<AdminDoctor | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const token = sessionStorage.getItem('hadimed_token')

  const loadDoctors = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = filter === 'ALL' ? '' : `?status=${encodeURIComponent(filter)}`
      const response = await fetch(`${API}/admin/doctors${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(result))
      const data = result.data ?? result
      setDoctors(Array.isArray(data.doctors) ? data.doctors : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'دریافت فهرست پزشکان ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }, [filter, token])

  useEffect(() => {
    void loadDoctors()
  }, [loadDoctors])

  const filteredDoctors = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return doctors
    return doctors.filter(doctor => {
      const fullName = `${doctor.user.firstName} ${doctor.user.lastName}`.toLowerCase()
      return fullName.includes(term) ||
        (doctor.user.email ?? '').toLowerCase().includes(term) ||
        (doctor.user.phone ?? '').includes(term) ||
        doctor.licenseNumber.toLowerCase().includes(term)
    })
  }, [doctors, search])

  const approveDoctor = async (doctor: AdminDoctor) => {
    if (!window.confirm(`آیا از تأیید درخواست ${doctor.user.firstName} ${doctor.user.lastName} مطمئن هستید؟`)) return
    setBusyId(doctor.id)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`${API}/admin/doctors/${doctor.id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(result))
      setNotice('درخواست پزشک با موفقیت تأیید شد و حساب کاربری او فعال گردید.')
      await loadDoctors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تأیید پزشک انجام نشد.')
    } finally {
      setBusyId('')
    }
  }

  const rejectDoctor = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!rejectTarget || rejectionReason.trim().length < 5) return
    const doctor = rejectTarget
    setBusyId(doctor.id)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`${API}/admin/doctors/${doctor.id}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(result))
      setRejectTarget(null)
      setRejectionReason('')
      setNotice('درخواست پزشک رد شد و دلیل رد ثبت گردید.')
      await loadDoctors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'رد درخواست انجام نشد.')
    } finally {
      setBusyId('')
    }
  }

  const counts = {
    total: doctors.length,
    pending: doctors.filter(item => item.verificationStatus === 'PENDING').length,
    review: doctors.filter(item => item.verificationStatus === 'UNDER_REVIEW').length,
    approved: doctors.filter(item => item.verificationStatus === 'APPROVED').length,
    rejected: doctors.filter(item => item.verificationStatus === 'REJECTED').length,
  }

  return (
    <main className="admin-dashboard" dir="rtl">
      <div className="admin-container">
        <section className="admin-welcome">
          <div>
            <span className="admin-kicker"><ShieldCheck size={17} /> مرکز کنترل HadiMed</span>
            <h1>پنل مدیریت سامانه</h1>
            <p>مدیریت پزشکان، بررسی مدارک و نظارت بر درخواست‌های عضویت</p>
          </div>
          <div className="admin-welcome-icon"><Activity size={35} /></div>
        </section>

        <section className="admin-stats">
          <article className="admin-stat">
            <span className="admin-stat-icon blue"><Users size={20} /></span>
            <div><small>کل پزشکان</small><strong>{counts.total.toLocaleString('fa-IR')}</strong></div>
          </article>
          <article className="admin-stat">
            <span className="admin-stat-icon orange"><Clock3 size={20} /></span>
            <div><small>در انتظار بررسی</small><strong>{counts.pending.toLocaleString('fa-IR')}</strong></div>
          </article>
          <article className="admin-stat">
            <span className="admin-stat-icon green"><CheckCircle2 size={20} /></span>
            <div><small>تأیید شده</small><strong>{counts.approved.toLocaleString('fa-IR')}</strong></div>
          </article>
          <article className="admin-stat">
            <span className="admin-stat-icon red"><XCircle size={20} /></span>
            <div><small>رد شده</small><strong>{counts.rejected.toLocaleString('fa-IR')}</strong></div>
          </article>
        </section>

        {error && <div className="admin-alert error"><AlertCircle size={18} />{error}</div>}
        {notice && <div className="admin-alert success"><CheckCircle2 size={18} />{notice}<button onClick={() => setNotice('')} aria-label="بستن"><X size={16} /></button></div>}

        <section className="admin-panel">
          <div className="admin-toolbar">
            <div>
              <h2>مدیریت درخواست پزشکان</h2>
              <p>فهرست پزشکان ثبت‌نام‌شده و وضعیت اعتبارسنجی آن‌ها</p>
            </div>
            <button className="admin-refresh" onClick={() => void loadDoctors()} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'admin-spin' : ''} />
              به‌روزرسانی
            </button>
          </div>

          <div className="admin-filters">
            <div className="admin-search">
              <Search size={18} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="جست‌وجوی نام، ایمیل، تلفن یا شماره نظام پزشکی..."
              />
            </div>
            <select value={filter} onChange={event => setFilter(event.target.value as FilterStatus)}>
              <option value="ALL">تمام وضعیت‌ها</option>
              <option value="PENDING">در انتظار بررسی</option>
              <option value="UNDER_REVIEW">در حال بررسی</option>
              <option value="APPROVED">تأیید شده</option>
              <option value="REJECTED">رد شده</option>
            </select>
          </div>

          {loading ? (
            <div className="admin-empty"><RefreshCw className="admin-spin" size={24} />در حال دریافت اطلاعات پزشکان...</div>
          ) : filteredDoctors.length === 0 ? (
            <div className="admin-empty"><Users size={28} />پزشکی با این مشخصات یافت نشد.</div>
          ) : (
            <div className="admin-doctor-list">
              {filteredDoctors.map(doctor => (
                <article className="admin-doctor-card" key={doctor.id}>
                  <div className="admin-doctor-main">
                    <div className="admin-avatar"><UserRound size={25} /></div>
                    <div className="admin-doctor-details">
                      <div className="admin-doctor-title">
                        <h3>{doctor.user.firstName} {doctor.user.lastName}</h3>
                        <span className={`admin-status ${doctor.verificationStatus.toLowerCase()}`}>
                          {statusLabels[doctor.verificationStatus]}
                        </span>
                      </div>
                      <div className="admin-doctor-meta">
                        <span><FileText size={14} /> شماره نظام پزشکی: {doctor.licenseNumber}</span>
                        <span><Mail size={14} /> {doctor.user.email || 'ثبت نشده'}</span>
                        <span><Phone size={14} /> {doctor.user.phone || 'ثبت نشده'}</span>
                        <span><Clock3 size={14} /> {doctor.yearsExperience.toLocaleString('fa-IR')} سال سابقه</span>
                      </div>
                      {doctor.biography && <p className="admin-biography">{doctor.biography}</p>}
                      {doctor.rejectionReason && <p className="admin-reason">دلیل رد: {doctor.rejectionReason}</p>}
                    </div>
                  </div>

                  {doctor.verificationStatus !== 'APPROVED' && (
                    <div className="admin-actions">
                      <button
                        className="admin-approve"
                        onClick={() => void approveDoctor(doctor)}
                        disabled={!!busyId}
                      >
                        {busyId === doctor.id ? <RefreshCw size={16} className="admin-spin" /> : <Check size={16} />}
                        تأیید پزشک
                      </button>
                      <button
                        className="admin-reject"
                        onClick={() => { setRejectTarget(doctor); setRejectionReason('') }}
                        disabled={!!busyId}
                      >
                        <X size={16} /> رد درخواست
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          <div className="admin-list-footer">
            نمایش {filteredDoctors.length.toLocaleString('fa-IR')} پزشک
            {counts.review > 0 && ` • ${counts.review.toLocaleString('fa-IR')} درخواست در حال بررسی`}
          </div>
        </section>
      </div>

      {rejectTarget && (
        <div className="admin-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget && !busyId) setRejectTarget(null)
        }}>
          <form className="admin-modal" onSubmit={rejectDoctor}>
            <div className="admin-modal-heading">
              <div><XCircle size={23} /><h2>رد درخواست پزشک</h2></div>
              <button type="button" onClick={() => setRejectTarget(null)} disabled={!!busyId}><X size={19} /></button>
            </div>
            <p>درخواست {rejectTarget.user.firstName} {rejectTarget.user.lastName} رد خواهد شد. دلیل رد را وارد کنید.</p>
            <label htmlFor="admin-rejection-reason">دلیل رد درخواست</label>
            <textarea
              id="admin-rejection-reason"
              value={rejectionReason}
              onChange={event => setRejectionReason(event.target.value)}
              minLength={5}
              maxLength={1000}
              required
              rows={5}
              placeholder="برای مثال: اطلاعات شماره نظام پزشکی نیاز به اصلاح دارد..."
            />
            <small>{rejectionReason.length.toLocaleString('fa-IR')} / ۱۰۰۰ کاراکتر</small>
            <div className="admin-modal-actions">
              <button type="button" className="admin-cancel" onClick={() => setRejectTarget(null)} disabled={!!busyId}>انصراف</button>
              <button type="submit" className="admin-confirm-reject" disabled={!!busyId || rejectionReason.trim().length < 5}>
                {busyId ? <RefreshCw size={16} className="admin-spin" /> : <X size={16} />}
                ثبت رد درخواست
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}