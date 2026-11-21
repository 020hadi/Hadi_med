import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowUpRight, BadgeCheck,
  CalendarDays, ClipboardList, FileText, FlaskConical, HeartPulse,
  LockKeyhole, Pill, Plus, RefreshCw, ShieldCheck, Stethoscope,
  UserRound, XCircle
} from 'lucide-react'
import DoctorBooking from './DoctorBooking'
import './PatientDashboard.css'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'

type AnyRecord = Record<string, any>

type Props = {
  firstName?: string
  lastName?: string
}

type DoctorOption = {
  doctorId: string
  firstName: string
  lastName: string
  specialties?: { name: string }[]
}

const unwrap = (value: any): any => value?.data ?? value?.value ?? value

const faDate = (value?: string | null) => {
  if (!value) return 'ثبت نشده'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(date)
}

const numberFa = (value: any) =>
  value === null || value === undefined ? '—' : Number(value).toLocaleString('fa-IR')

const request = async (path: string, options: RequestInit = {}) => {
  const token = sessionStorage.getItem('hadimed_token')
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      payload?.message || payload?.error?.message ||
      `خطا در ارتباط با سرور (${response.status})`
    )
  }

  return unwrap(payload)
}

export default function PatientDashboard({ firstName, lastName }: Props) {
  const [record, setRecord] = useState<AnyRecord | null>(null)
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [appointments, setAppointments] = useState<AnyRecord[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
  const [bookingDoctor, setBookingDoctor] = useState<DoctorOption | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('overview')
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDateOfBirth, setProfileDateOfBirth] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [allergen, setAllergen] = useState('')
  const [allergyReaction, setAllergyReaction] = useState('')
  const [allergySeverity, setAllergySeverity] = useState('UNKNOWN')
  const [allergyNotes, setAllergyNotes] = useState('')
  const [conditionTitle, setConditionTitle] = useState('')
  const [conditionDescription, setConditionDescription] = useState('')
  const [conditionDiagnosedAt, setConditionDiagnosedAt] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [purpose, setPurpose] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [editKind, setEditKind] = useState<'allergy' | 'condition' | null>(null)
  const [editDraft, setEditDraft] = useState<AnyRecord>({})
  const [editSaving, setEditSaving] = useState(false)
  const [editItemId, setEditItemId] = useState('')

  const loadRecord = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await request('/medical-records/me')
      setRecord(data)
    } catch (err) {
      setRecord(null)
      setError(err instanceof Error ? err.message : 'دریافت پرونده ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAppointments = useCallback(async () => {
    setAppointmentsLoading(true)
    try {
      const data = await request('/appointments/me')
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.appointments)
          ? data.appointments
          : []
      setAppointments(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'دریافت نوبت‌ها ناموفق بود.')
    } finally {
      setAppointmentsLoading(false)
    }
  }, [])
  useEffect(() => {
    void loadRecord()
    void loadAppointments()
    request('/doctors')
      .then((data) => setDoctors(Array.isArray(data) ? data : []))
      .catch(() => setDoctors([]))
  }, [loadRecord, loadAppointments])

  useEffect(() => {
    const patient = record?.patientProfile
    if (!patient) return

    setProfileDateOfBirth(
      patient.dateOfBirth ? String(patient.dateOfBirth).slice(0, 10) : ''
    )
    setBloodType(patient.bloodType || '')
    setEmergencyContact(patient.emergencyContact || '')
  }, [record])
  const createRecord = async () => {
    setCreating(true)
    setError('')
    setNotice('')
    try {
      await request('/medical-records/me', { method: 'POST' })
      setNotice('پرونده پزشکی شما با موفقیت ایجاد شد.')
      await loadRecord()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ایجاد پرونده ناموفق بود.')
    } finally {
      setCreating(false)
    }
  }

  const savePatientProfile = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')

    try {
      await request('/medical-records/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          dateOfBirth: profileDateOfBirth || null,
          bloodType: bloodType.trim() || null,
          emergencyContact: emergencyContact.trim() || null,
        }),
      })

      setEditingProfile(false)
      setNotice('اطلاعات پروفایل پزشکی با موفقیت ذخیره شد.')
      await loadRecord()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره پروفایل ناموفق بود.')
    }
  }

  const addPatientAllergy = async (event: FormEvent) => {
    event.preventDefault()
    if (!allergen.trim()) return

    setError('')
    setNotice('')

    try {
      await request('/medical-records/me/allergies', {
        method: 'POST',
        body: JSON.stringify({
          allergen: allergen.trim(),
          reaction: allergyReaction.trim() || undefined,
          severity: allergySeverity,
          notes: allergyNotes.trim() || undefined,
        }),
      })

      setAllergen('')
      setAllergyReaction('')
      setAllergySeverity('UNKNOWN')
      setAllergyNotes('')
      setNotice('حساسیت جدید ثبت شد.')
      await loadRecord()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت حساسیت ناموفق بود.')
    }
  }

  const editAllergy = (item: AnyRecord) => {
    setEditItemId(item.id)
    setEditKind('allergy')
    setEditDraft({
      allergen: item.allergen ?? '',
      reaction: item.reaction ?? '',
      severity: item.severity ?? 'UNKNOWN',
      notes: item.notes ?? '',
    })
    setError('')
    setNotice('')
  }
  const deactivateAllergy = async (id: string) => {
    if (!window.confirm('این حساسیت غیرفعال شود؟ سابقه آن حذف نخواهد شد.')) return

    setError('')
    setNotice('')

    try {
      await request(`/medical-records/me/allergies/${id}/deactivate`, {
        method: 'PATCH',
      })
      setNotice('حساسیت غیرفعال شد.')
      await loadRecord()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'غیرفعال‌سازی ناموفق بود.')
    }
  }

  const addPatientCondition = async (event: FormEvent) => {
    event.preventDefault()
    if (!conditionTitle.trim()) return

    setError('')
    setNotice('')

    try {
      await request('/medical-records/me/conditions', {
        method: 'POST',
        body: JSON.stringify({
          title: conditionTitle.trim(),
          description: conditionDescription.trim() || undefined,
          diagnosedAt: conditionDiagnosedAt || undefined,
        }),
      })

      setConditionTitle('')
      setConditionDescription('')
      setConditionDiagnosedAt('')
      setNotice('بیماری زمینه‌ای ثبت شد.')
      await loadRecord()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت بیماری ناموفق بود.')
    }
  }
  const editCondition = (item: AnyRecord) => {
    setEditItemId(item.id)
    setEditKind('condition')
    setEditDraft({
      title: item.title ?? '',
      description: item.description ?? '',
      diagnosedAt: item.diagnosedAt ? String(item.diagnosedAt).slice(0, 10) : '',
    })
    setError('')
    setNotice('')
  }

  const closeEditForm = () => {
    if (editSaving) return
    setEditKind(null)
    setEditItemId('')
    setEditDraft({})
  }

  const saveEditForm = async (event: FormEvent) => {
    event.preventDefault()
    if (!editKind || !editItemId || editSaving) return

    if (editKind === 'allergy') {
      const severity = String(editDraft.severity ?? 'UNKNOWN').toUpperCase()
      const allowed = ['UNKNOWN', 'MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING']

      if (!String(editDraft.allergen ?? '').trim()) {
        setError('نام ماده حساسیت‌زا الزامی است.')
        return
      }
      if (!allowed.includes(severity)) {
        setError('شدت حساسیت معتبر نیست.')
        return
      }
    }

    if (editKind === 'condition' && !String(editDraft.title ?? '').trim()) {
      setError('عنوان بیماری الزامی است.')
      return
    }

    setEditSaving(true)
    setError('')
    setNotice('')

    try {
      if (editKind === 'allergy') {
        await request(`/medical-records/me/allergies/${editItemId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            allergen: String(editDraft.allergen).trim(),
            reaction: String(editDraft.reaction ?? '').trim(),
            severity: String(editDraft.severity ?? 'UNKNOWN').toUpperCase(),
            notes: String(editDraft.notes ?? '').trim(),
          }),
        })
        setNotice('اطلاعات حساسیت به‌روزرسانی شد.')
      } else {
        await request(`/medical-records/me/conditions/${editItemId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: String(editDraft.title).trim(),
            description: String(editDraft.description ?? '').trim(),
            diagnosedAt: editDraft.diagnosedAt || null,
          }),
        })
        setNotice('اطلاعات بیماری به‌روزرسانی شد.')
      }

      setEditKind(null)
      setEditItemId('')
      setEditDraft({})
      await loadRecord()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره تغییرات انجام نشد.')
    } finally {
      setEditSaving(false)
    }
  }
  const deactivateCondition = async (id: string) => {
    if (!window.confirm('این بیماری غیرفعال شود؟ سابقه آن حفظ خواهد شد.')) return

    setError('')
    setNotice('')

    try {
      await request(`/medical-records/me/conditions/${id}/deactivate`, {
        method: 'PATCH',
      })
      setNotice('بیماری غیرفعال شد.')
      await loadRecord()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'غیرفعال‌سازی ناموفق بود.')
    }
  }
  const grantConsent = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedDoctor) {
      setError('ابتدا پزشک موردنظر را انتخاب کنید.')
      return
    }

    setError('')
    setNotice('')
    try {
      await request('/medical-records/me/consents', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctor,
          purpose: purpose.trim() || undefined,
          expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : undefined,
        }),
      })
      setPurpose('')
      setExpiresAt('')
      setSelectedDoctor('')
      setNotice('دسترسی پزشک با موفقیت ثبت شد.')
      await loadRecord()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت دسترسی ناموفق بود.')
    }
  }

  const revokeConsent = async (consentId: string) => {
    if (!window.confirm('آیا از لغو دسترسی این پزشک مطمئن هستید؟')) return
    setError('')
    setNotice('')
    try {
      await request(`/medical-records/me/consents/${consentId}`, { method: 'DELETE' })
      setNotice('دسترسی پزشک لغو شد.')
      await loadRecord()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'لغو دسترسی ناموفق بود.')
    }
  }

  const cancelAppointment = async (appointmentId: string) => {
    if (!window.confirm('آیا از لغو این نوبت مطمئن هستید؟')) return

    setError('')
    setNotice('')

    try {
      await request(`/appointments/me/${appointmentId}`, {
        method: 'DELETE',
      })
      setNotice('نوبت با موفقیت لغو شد.')
      await loadAppointments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'لغو نوبت ناموفق بود.')
    }
  }
  const profile = record?.patientProfile
  const encounters = useMemo(
    () => (record?.encounters ?? []).filter((item: AnyRecord) =>
      ['SIGNED', 'AMENDED'].includes(item.status)
    ),
    [record]
  )

  const prescriptions = encounters.flatMap((encounter: AnyRecord) =>
    (encounter.prescriptions ?? []).map((item: AnyRecord) => ({
      ...item,
      encounterDate: encounter.createdAt,
    }))
  )
  const activeConsents = (record?.consents ?? []).filter(
    (item: AnyRecord) => item.status === 'ACTIVE' && !item.revokedAt &&
      (!item.expiresAt || new Date(item.expiresAt) > new Date())
  )

  const tabs = [
    { id: 'overview', label: 'نمای کلی', icon: Activity },
    { id: 'visits', label: 'سوابق مراجعه', icon: ClipboardList },
    { id: 'prescriptions', label: 'نسخه‌ها', icon: Pill },
    { id: 'labs', label: 'آزمایش‌ها', icon: FlaskConical },
    { id: 'documents', label: 'مدارک', icon: FileText },
    { id: 'access', label: 'دسترسی پزشکان', icon: ShieldCheck },
    { id: 'booking', label: 'رزرو نوبت', icon: CalendarDays },
    { id: 'appointments', label: 'نوبت‌های من', icon: ClipboardList },
  ]

  if (loading) {
    return <div className="patient-loading"><RefreshCw className="patient-spin" /> در حال دریافت پرونده پزشکی...</div>
  }

  if (!record) {
    return (
      <main className="patient-shell" dir="rtl">
        <section className="patient-empty">
          <div className="patient-empty-icon"><HeartPulse size={38} /></div>
          <h2>Medical record</h2>
          <p>Your medical record has not been created yet. You can still book appointments.</p>

          {error && <div className="patient-alert error"><AlertCircle size={18} />{error}</div>}
          {notice && <div className="patient-alert success"><BadgeCheck size={18} />{notice}</div>}

          <div className="patient-section-heading">
            <button type="button" className="patient-primary" onClick={() => setTab('booking')}>
              <CalendarDays size={17} /> Book appointment
            </button>
            <button type="button" className="patient-secondary" onClick={() => setTab('appointments')}>
              <ClipboardList size={17} /> My appointments
            </button>
          </div>

          {tab === 'booking' && (
            <div className="patient-doctor-grid">
              {doctors.map((doctor) => (
                <article className="patient-doctor-card" key={doctor.doctorId}>
                  <div className="patient-doctor-icon"><Stethoscope size={25} /></div>
                  <h3>Dr. {doctor.firstName} {doctor.lastName}</h3>
                  <p>{(doctor.specialties ?? []).map((item) => item.name).join(', ') || 'Doctor'}</p>
                  <button
                    type="button"
                    className="patient-primary"
                    onClick={() => setBookingDoctor(doctor)}
                  >
                    <CalendarDays size={17} /> Select time and book
                  </button>
                </article>
              ))}
              {doctors.length === 0 && (
                <p className="patient-empty-inline">No doctors are currently available.</p>
              )}
            </div>
          )}

          {tab === 'appointments' && (
            <div className="patient-appointment-list">
              <button
                type="button"
                className="patient-refresh"
                onClick={loadAppointments}
                disabled={appointmentsLoading}
              >
                <RefreshCw size={16} /> Refresh
              </button>

              {appointmentsLoading && <p className="patient-empty-inline">Loading appointments...</p>}

              {!appointmentsLoading && appointments.length === 0 && (
                <p className="patient-empty-inline">You have no appointments yet.</p>
              )}

              {appointments.map((appointment) => {
                const start = new Date(appointment.startAt)
                const canCancel = appointment.status === 'CONFIRMED' && start > new Date()

                return (
                  <article className="patient-appointment-card" key={appointment.id}>
                    <div className="patient-appointment-main">
                      <div className="patient-appointment-icon"><CalendarDays size={22} /></div>
                      <div>
                        <h3>Dr. {appointment.doctor?.firstName ?? ''} {appointment.doctor?.lastName ?? ''}</h3>
                        <p>{faDate(appointment.startAt)} — {start.toLocaleTimeString('fa-IR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Tehran',
                        })}</p>
                        <span>{appointment.trackingCode}</span>
                      </div>
                    </div>
                    {canCancel && (
                      <button
                        type="button"
                        className="patient-appointment-cancel"
                        onClick={() => cancelAppointment(appointment.id)}
                      >
                        <XCircle size={16} /> Cancel
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          <button className="patient-secondary" onClick={createRecord} disabled={creating}>
            <Plus size={18} /> {creating ? 'Creating...' : 'Create medical record'}
          </button>
        </section>

        {bookingDoctor && (
          <DoctorBooking
            doctor={bookingDoctor}
            api={API}
            authenticated
            onBooked={() => {
              void loadAppointments()
              setNotice('Appointment booked successfully.')
            }}
            onClose={() => setBookingDoctor(null)}
          />
        )}
      </main>
    )
  }

  return (
    <main className="patient-shell" dir="rtl">
      <section className="patient-welcome">
        <div>
          <div className="patient-eyebrow"><ShieldCheck size={16} /> پنل اختصاصی بیمار</div>
          <h1>سلام {firstName || profile?.user?.firstName || 'کاربر'} عزیز</h1>
          <p>به مرکز مدیریت سلامت و پرونده پزشکی خود خوش آمدید.</p>
        </div>
        <div className="patient-record-status">
          <span className="patient-status-dot" />
          پرونده {record.status === 'ACTIVE' ? 'فعال' : record.status}
          <small>شناسه: {String(record.id || '').slice(0, 8)}</small>
        </div>
      </section>

      {notice && <div className="patient-alert success"><BadgeCheck size={18} />{notice}</div>}
      {error && <div className="patient-alert error"><AlertCircle size={18} />{error}</div>}

      <section className="patient-stats">
        <article><span className="patient-stat-icon blue"><ClipboardList /></span><div><strong>{numberFa(encounters.length)}</strong><small>مراجعه ثبت‌شده</small></div></article>
        <article><span className="patient-stat-icon purple"><Pill /></span><div><strong>{numberFa(prescriptions.length)}</strong><small>نسخه پزشکی</small></div></article>
        <article><span className="patient-stat-icon orange"><FlaskConical /></span><div><strong>{numberFa(record.labResults?.length ?? 0)}</strong><small>نتیجه آزمایش</small></div></article>
        <article><span className="patient-stat-icon green"><ShieldCheck /></span><div><strong>{numberFa(activeConsents.length)}</strong><small>دسترسی فعال پزشکان</small></div></article>
      </section>

      <div className="patient-layout">
        <aside className="patient-sidebar">
          <div className="patient-profile-card">
            <div className="patient-avatar"><UserRound size={30} /></div>
            <strong>{profile?.user?.firstName || firstName || 'بیمار'} {profile?.user?.lastName || lastName || ''}</strong>
            <span>پرونده بیمار</span>
            <div className="patient-profile-meta">
              <span>گروه خونی</span><b>{profile?.bloodType || 'ثبت نشده'}</b>
            </div>
            <div className="patient-profile-meta">
              <span>تاریخ تولد</span><b>{faDate(profile?.dateOfBirth)}</b>
            </div>
          </div>
          <nav className="patient-tabs">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                <Icon size={18} />{label}<ArrowUpRight size={14} className="patient-tab-arrow" />
              </button>
            ))}
          </nav>
          <div className="patient-privacy-note">
            <LockKeyhole size={18} />
            <div><b>حریم خصوصی شما</b><small>دسترسی پزشکان تحت کنترل شماست.</small></div>
          </div>
        </aside>

        <section className="patient-content">
          {tab === 'booking' && (
            <div className="patient-panel patient-appointments-panel">
              <div className="patient-section-heading">
                <div>
                  <h2>رزرو نوبت پزشکی</h2>
                  <p>پزشک موردنظر را انتخاب کنید و زمان آزاد را رزرو کنید.</p>
                </div>
              </div>

              <div className="patient-doctor-grid">
                {doctors.map((doctor) => (
                  <article className="patient-doctor-card" key={doctor.doctorId}>
                    <div className="patient-doctor-icon"><Stethoscope size={25} /></div>
                    <h3>دکتر {doctor.firstName} {doctor.lastName}</h3>
                    <p>
                      {(doctor.specialties ?? []).map((item) => item.name).join('، ') || 'پزشک'}
                    </p>
                    <button
                      type="button"
                      className="patient-primary"
                      onClick={() => setBookingDoctor(doctor)}
                    >
                      <CalendarDays size={17} /> انتخاب زمان و رزرو
                    </button>
                  </article>
                ))}
                {doctors.length === 0 && (
                  <p className="patient-empty-inline">در حال حاضر پزشکی برای رزرو نمایش داده نمی‌شود.</p>
                )}
              </div>
            </div>
          )}

          {tab === 'appointments' && (
            <div className="patient-panel patient-appointments-panel">
              <div className="patient-section-heading">
                <div>
                  <h2>نوبت‌های من</h2>
                  <p>فهرست نوبت‌های آینده و سوابق نوبت‌های شما</p>
                </div>
                <button
                  type="button"
                  className="patient-refresh"
                  onClick={loadAppointments}
                  disabled={appointmentsLoading}
                >
                  <RefreshCw size={16} /> به‌روزرسانی
                </button>
              </div>

              {appointmentsLoading && (
                <p className="patient-empty-inline">در حال دریافت نوبت‌ها...</p>
              )}

              {!appointmentsLoading && appointments.length === 0 && (
                <div className="patient-empty-inline">
                  <CalendarDays size={30} />
                  <p>هنوز نوبتی برای حساب شما ثبت نشده است.</p>
                  <button type="button" className="patient-primary" onClick={() => setTab('booking')}>
                    رزرو اولین نوبت
                  </button>
                </div>
              )}

              <div className="patient-appointment-list">
                {appointments.map((appointment) => {
                  const start = new Date(appointment.startAt)
                  const isFuture = start > new Date()
                  const canCancel = appointment.status === 'CONFIRMED' && isFuture
                  const statusLabels: Record<string, string> = {
                    PENDING_VERIFICATION: 'در انتظار تأیید',
                    CONFIRMED: 'تأیید شده',
                    CANCELLED: 'لغو شده',
                    EXPIRED: 'منقضی شده',
                  }

                  return (
                    <article className="patient-appointment-card" key={appointment.id}>
                      <div className="patient-appointment-main">
                        <div className="patient-appointment-icon">
                          <CalendarDays size={22} />
                        </div>
                        <div>
                          <h3>
                            دکتر {appointment.doctor?.firstName ?? ''} {appointment.doctor?.lastName ?? ''}
                          </h3>
                          <p>{(appointment.doctor?.specialties ?? []).join('، ')}</p>
                          <div className="patient-appointment-meta">
                            <span>{faDate(appointment.startAt)}</span>
                            <span>
                              {start.toLocaleTimeString('fa-IR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Asia/Tehran',
                              })}
                            </span>
                            <span>کد رهگیری: {appointment.trackingCode}</span>
                          </div>
                        </div>
                      </div>
                      <div className="patient-appointment-actions">
                        <span className={`patient-appointment-status status-${String(appointment.status).toLowerCase()}`}>
                          {statusLabels[appointment.status] ?? appointment.status}
                        </span>
                        {canCancel && (
                          <button
                            type="button"
                            className="patient-appointment-cancel"
                            onClick={() => cancelAppointment(appointment.id)}
                          >
                            <XCircle size={16} /> لغو نوبت
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
          {tab === 'overview' && (
            <>
              <div className="patient-section-heading">
                <div><h2>خلاصه وضعیت پزشکی</h2><p>مروری بر اطلاعات ثبت‌شده در پرونده شما</p></div>
                <button className="patient-refresh" onClick={loadRecord}><RefreshCw size={16} /> به‌روزرسانی</button>
              </div>

              <article className="patient-panel patient-profile-editor">
                <div className="patient-section-heading">
                  <div>
                    <h3><UserRound size={19} /> اطلاعات پایه پزشکی</h3>
                    <p>اطلاعات پایه پرونده خود را مدیریت کنید.</p>
                  </div>
                  <button
                    type="button"
                    className="patient-secondary"
                    onClick={() => setEditingProfile((value) => !value)}
                  >
                    {editingProfile ? 'بستن ویرایش' : 'ویرایش اطلاعات'}
                  </button>
                </div>

                {editingProfile ? (
                  <form className="patient-editor-grid" onSubmit={savePatientProfile}>
                    <label>
                      تاریخ تولد
                      <input
                        type="date"
                        value={profileDateOfBirth}
                        onChange={(e) => setProfileDateOfBirth(e.target.value)}
                      />
                    </label>
                    <label>
                      گروه خونی
                      <select value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
                        <option value="">ثبت نشده</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      شماره تماس اضطراری
                      <input
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        maxLength={30}
                        placeholder="شماره تماس ضروری"
                      />
                    </label>
                    <button className="patient-primary" type="submit">ذخیره اطلاعات</button>
                  </form>
                ) : (
                  <div className="patient-editor-grid">
                    <div><small>تاریخ تولد</small><b>{faDate(profile?.dateOfBirth)}</b></div>
                    <div><small>گروه خونی</small><b>{profile?.bloodType || 'ثبت نشده'}</b></div>
                    <div><small>تماس اضطراری</small><b>{profile?.emergencyContact || 'ثبت نشده'}</b></div>
                  </div>
                )}
              </article>
              <div className="patient-overview-grid">
                <article className="patient-panel">
                  <h3><HeartPulse size={19} /> علائم حیاتی</h3>
                  {record.vitalSigns?.length ? record.vitalSigns.slice(0, 1).map((v: AnyRecord) => (
                    <div key={v.id} className="patient-vitals">
                      <div><b>{numberFa(v.systolic)} / {numberFa(v.diastolic)}</b><small>فشار خون</small></div>
                      <div><b>{numberFa(v.heartRate)}</b><small>ضربان قلب</small></div>
                      <div><b>{numberFa(v.temperatureC)}</b><small>دما (°C)</small></div>
                      <div><b>{numberFa(v.oxygenSaturation)}%</b><small>اکسیژن خون</small></div>
                      <small className="patient-muted">آخرین اندازه‌گیری: {faDate(v.measuredAt)}</small>
                    </div>
                  )) : <p className="patient-muted">هنوز علائم حیاتی ثبت نشده است.</p>}
                </article>

                <article className="patient-panel">
                  <h3><AlertTriangle size={19} /> حساسیت‌ها</h3>
                  {profile?.allergies?.length ? profile.allergies.map((item: AnyRecord) => (
                    <div className="patient-list-row" key={item.id}>
                      <div><b>{item.allergen}</b><small>{item.reaction || 'واکنش ثبت نشده'}</small></div>
                      <button type="button" className="patient-revoke" onClick={() => editAllergy(item)}>
                        Edit
                      </button>
                      <span className="patient-tag warning">{item.severity}</span>
                      <button type="button" className="patient-revoke" onClick={() => deactivateAllergy(item.id)}>
                        غیرفعال‌سازی
                      </button>
                    </div>
                  )) : <p className="patient-muted">مورد فعالی ثبت نشده است.</p>}

                  <form className="patient-inline-form" onSubmit={addPatientAllergy}>
                    <h4>ثبت حساسیت جدید</h4>
                    <input
                      value={allergen}
                      onChange={(e) => setAllergen(e.target.value)}
                      placeholder="نام ماده حساسیت‌زا"
                      maxLength={150}
                      required
                    />
                    <input
                      value={allergyReaction}
                      onChange={(e) => setAllergyReaction(e.target.value)}
                      placeholder="نوع واکنش (اختیاری)"
                      maxLength={500}
                    />
                    <select
                      value={allergySeverity}
                      onChange={(e) => setAllergySeverity(e.target.value)}
                    >
                      <option value="UNKNOWN">شدت نامشخص</option>
                      <option value="MILD">خفیف</option>
                      <option value="MODERATE">متوسط</option>
                      <option value="SEVERE">شدید</option>
                      <option value="LIFE_THREATENING">تهدیدکننده حیات</option>
                    </select>
                    <textarea
                      value={allergyNotes}
                      onChange={(e) => setAllergyNotes(e.target.value)}
                      placeholder="توضیحات تکمیلی (اختیاری)"
                      rows={2}
                      maxLength={2000}
                    />
                    <button className="patient-primary" type="submit">
                      <Plus size={16} /> ثبت حساسیت
                    </button>
                  </form>
                </article>

                <article className="patient-panel">
                  <h3><Activity size={19} /> بیماری‌های زمینه‌ای</h3>
                  {profile?.conditions?.length ? profile.conditions.map((item: AnyRecord) => (
                    <div className="patient-list-row" key={item.id}>
                      <div><b>{item.title}</b><small>{item.description || 'بدون توضیحات'}</small></div>
                      <span className={`patient-tag ${item.isActive ? 'success' : ''}`}>{item.isActive ? 'فعال' : 'غیرفعال'}</span>
                      <button type="button" className="patient-revoke" onClick={() => editCondition(item)}>
                        Edit
                      </button>
                      {item.isActive && (
                        <button type="button" className="patient-revoke" onClick={() => deactivateCondition(item.id)}>
                          غیرفعال‌سازی
                        </button>
                      )}
                    </div>
                  )) : <p className="patient-muted">بیماری زمینه‌ای ثبت نشده است.</p>}

                  <form className="patient-inline-form" onSubmit={addPatientCondition}>
                    <h4>ثبت بیماری زمینه‌ای</h4>
                    <input
                      value={conditionTitle}
                      onChange={(e) => setConditionTitle(e.target.value)}
                      placeholder="عنوان بیماری"
                      maxLength={200}
                      required
                    />
                    <textarea
                      value={conditionDescription}
                      onChange={(e) => setConditionDescription(e.target.value)}
                      placeholder="توضیحات بیماری (اختیاری)"
                      rows={2}
                      maxLength={2000}
                    />
                    <label>تاریخ تشخیص (اختیاری)</label>
                    <input
                      type="date"
                      value={conditionDiagnosedAt}
                      onChange={(e) => setConditionDiagnosedAt(e.target.value)}
                    />
                    <button className="patient-primary" type="submit">
                      <Plus size={16} /> ثبت بیماری
                    </button>
                  </form>
                </article>

                <article className="patient-panel">
                  <h3><CalendarDays size={19} /> آخرین مراجعه</h3>
                  {encounters[0] ? (
                    <>
                      <b>{encounters[0].chiefComplaint || 'شرح مراجعه ثبت نشده'}</b>
                      <p className="patient-muted">{faDate(encounters[0].createdAt)}</p>
                      <p>پزشک: {encounters[0].doctor?.user?.firstName || ''} {encounters[0].doctor?.user?.lastName || 'ثبت نشده'}</p>
                    </>
                  ) : <p className="patient-muted">هنوز مراجعه نهایی‌شده‌ای ثبت نشده است.</p>}
                </article>
              </div>
            </>
          )}

          {tab === 'visits' && (
            <>
              <div className="patient-section-heading"><div><h2>سوابق مراجعه</h2><p>مراجعات نهایی‌شده و ثبت‌شده توسط پزشکان</p></div></div>
              {encounters.length ? encounters.map((item: AnyRecord) => (
                <article className="patient-panel patient-visit" key={item.id}>
                  <div className="patient-visit-top">
                    <div><h3>{item.chiefComplaint || 'مراجعه پزشکی'}</h3><small>{faDate(item.createdAt)}</small></div>
                    <span className="patient-tag success">{item.status === 'SIGNED' ? 'تأیید نهایی' : 'اصلاح‌شده'}</span>
                  </div>
                  <p><b>پزشک:</b> {item.doctor?.user?.firstName || ''} {item.doctor?.user?.lastName || 'ثبت نشده'}</p>
                  {item.assessment && <p><b>ارزیابی:</b> {item.assessment}</p>}
                  {item.plan && <p><b>برنامه درمان:</b> {item.plan}</p>}
                  {item.diagnoses?.length > 0 && <div className="patient-inline-tags">{item.diagnoses.map((d: AnyRecord) => <span key={d.id}>{d.title}</span>)}</div>}
                </article>
              )) : <p className="patient-muted">سابقه مراجعه نهایی‌شده‌ای وجود ندارد.</p>}
            </>
          )}

          {tab === 'prescriptions' && (
            <>
              <div className="patient-section-heading"><div><h2>نسخه‌های پزشکی</h2><p>داروها و دستورهای ثبت‌شده توسط پزشک</p></div></div>
              {prescriptions.length ? prescriptions.map((item: AnyRecord) => (
                <article className="patient-panel patient-visit" key={item.id}>
                  <div className="patient-visit-top">
                    <div><h3><Pill size={18} /> نسخه دارویی</h3><small>{faDate(item.issuedAt || item.createdAt)}</small></div>
                    <span className="patient-tag">{item.status}</span>
                  </div>
                  {item.items?.length ? item.items.map((medicine: AnyRecord) => (
                    <div className="patient-medicine" key={medicine.id}>
                      <b>{medicine.medicationName}</b>
                      <span>{[medicine.dosage, medicine.route, medicine.frequency, medicine.duration].filter(Boolean).join(' • ')}</span>
                      {medicine.instructions && <small>{medicine.instructions}</small>}
                    </div>
                  )) : <p className="patient-muted">اقلام دارویی برای این نسخه ثبت نشده است.</p>}
                  {item.instructions && <p>{item.instructions}</p>}
                </article>
              )) : <p className="patient-muted">نسخه‌ای ثبت نشده است.</p>}
            </>
          )}

          {tab === 'labs' && (
            <>
              <div className="patient-section-heading"><div><h2>نتایج آزمایش‌ها</h2><p>نتایج ثبت‌شده در پرونده پزشکی</p></div></div>
              {record.labResults?.length ? record.labResults.map((item: AnyRecord) => (
                <article className="patient-panel patient-lab" key={item.id}>
                  <div><b>{item.testName}</b><small>{item.laboratory || 'آزمایشگاه ثبت نشده'} · {faDate(item.performedAt || item.createdAt)}</small></div>
                  <strong>{item.value || 'نتیجه ثبت نشده'} {item.unit || ''}</strong>
                  <span>{item.resultStatus || '—'}</span>
                  {item.referenceRange && <small>محدوده مرجع: {item.referenceRange}</small>}
                  {item.notes && <p>{item.notes}</p>}
                </article>
              )) : <p className="patient-muted">نتیجه آزمایشی ثبت نشده است.</p>}
            </>
          )}

          {tab === 'documents' && (
            <>
              <div className="patient-section-heading"><div><h2>مدارک پزشکی</h2><p>فهرست فایل‌های ثبت‌شده در پرونده</p></div></div>
              {record.documents?.length ? record.documents.map((item: AnyRecord) => (
                <article className="patient-panel patient-document" key={item.id}>
                  <FileText size={22} />
                  <div><b>{item.fileName}</b><small>{item.category || 'بدون دسته‌بندی'} · {faDate(item.createdAt)}</small><small>{item.description || item.mimeType}</small></div>
                  <span>{numberFa(Math.round(Number(item.sizeBytes || 0) / 1024))} KB</span>
                </article>
              )) : <p className="patient-muted">مدرکی در پرونده ثبت نشده است.</p>}
              <p className="patient-info-note">نمایش و دریافت فایل‌ها پس از فعال‌سازی سرویس دانلود امن مدارک در دسترس قرار می‌گیرد.</p>
            </>
          )}

          {tab === 'access' && (
            <>
              <div className="patient-section-heading"><div><h2>مدیریت دسترسی پزشکان</h2><p>مجوز مشاهده پرونده پزشکی را خودتان مدیریت کنید.</p></div></div>

              <form className="patient-panel patient-consent-form" onSubmit={grantConsent}>
                <h3><ShieldCheck size={19} /> اعطای دسترسی جدید</h3>
                <label>پزشک موردنظر</label>
                <select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)} required>
                  <option value="">انتخاب پزشک</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.doctorId} value={doctor.doctorId}>
                      دکتر {doctor.firstName} {doctor.lastName}
                    </option>
                  ))}
                </select>
                <label>هدف از دسترسی (اختیاری)</label>
                <input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={500} placeholder="مثلاً بررسی سوابق برای ادامه درمان" />
                <label>تاریخ انقضای دسترسی (اختیاری)</label>
                <input type="date" value={expiresAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpiresAt(e.target.value)} />
                <button className="patient-primary" type="submit"><Plus size={17} /> ثبت مجوز دسترسی</button>
                {!doctors.length && <small className="patient-muted">فهرست پزشکان در حال حاضر در دسترس نیست.</small>}
              </form>

              <h3 className="patient-subheading">مجوزهای ثبت‌شده</h3>
              {(record.consents ?? []).length ? record.consents.map((item: AnyRecord) => (
                <article className="patient-panel patient-consent-row" key={item.id}>
                  <div className="patient-consent-icon"><Stethoscope /></div>
                  <div className="patient-consent-details">
                    <b>دکتر {item.doctor?.user?.firstName || ''} {item.doctor?.user?.lastName || ''}</b>
                    <small>هدف: {item.purpose || 'تعیین نشده'}</small>
                    <small>تاریخ ثبت: {faDate(item.createdAt)} · انقضا: {faDate(item.expiresAt)}</small>
                  </div>
                  <div className="patient-consent-actions">
                    <span className={`patient-tag ${activeConsents.some((c: AnyRecord) => c.id === item.id) ? 'success' : 'muted'}`}>
                      {activeConsents.some((c: AnyRecord) => c.id === item.id) ? 'فعال' : item.status === 'REVOKED' ? 'لغوشده' : 'منقضی'}
                    </span>
                    {item.status === 'ACTIVE' && !item.revokedAt && (
                      <button className="patient-revoke" onClick={() => revokeConsent(item.id)}><XCircle size={16} /> لغو دسترسی</button>
                    )}
                  </div>
                </article>
              )) : <p className="patient-muted">هنوز مجوزی برای پزشکان ثبت نکرده‌اید.</p>}
            </>
          )}
        </section>
      </div>
      {editKind && (
        <div
          className="patient-edit-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditForm()
          }}
        >
          <section
            className="patient-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-edit-title"
            dir="rtl"
          >
            <header className="patient-edit-header">
              <div>
                <span className="patient-edit-eyebrow">پرونده پزشکی من</span>
                <h2 id="patient-edit-title">
                  {editKind === 'allergy' ? 'ویرایش حساسیت' : 'ویرایش بیماری زمینه‌ای'}
                </h2>
                <p>اطلاعات را بررسی و تغییرات را ذخیره کنید.</p>
              </div>
              <button
                type="button"
                className="patient-edit-close"
                onClick={closeEditForm}
                disabled={editSaving}
                aria-label="بستن"
              >
                <XCircle size={21} />
              </button>
            </header>

            <form className="patient-edit-form" onSubmit={saveEditForm}>
              {editKind === 'allergy' ? (
                <>
                  <label>
                    نام ماده حساسیت‌زا
                    <input
                      autoFocus
                      required
                      maxLength={150}
                      value={editDraft.allergen ?? ''}
                      onChange={(e) => setEditDraft((old) => ({ ...old, allergen: e.target.value }))}
                    />
                  </label>
                  <label>
                    نوع واکنش
                    <input
                      maxLength={500}
                      value={editDraft.reaction ?? ''}
                      onChange={(e) => setEditDraft((old) => ({ ...old, reaction: e.target.value }))}
                    />
                  </label>
                  <label>
                    شدت حساسیت
                    <select
                      value={editDraft.severity ?? 'UNKNOWN'}
                      onChange={(e) => setEditDraft((old) => ({ ...old, severity: e.target.value }))}
                    >
                      <option value="UNKNOWN">نامشخص</option>
                      <option value="MILD">خفیف</option>
                      <option value="MODERATE">متوسط</option>
                      <option value="SEVERE">شدید</option>
                      <option value="LIFE_THREATENING">تهدیدکننده حیات</option>
                    </select>
                  </label>
                  <label>
                    توضیحات تکمیلی
                    <textarea
                      rows={4}
                      maxLength={2000}
                      value={editDraft.notes ?? ''}
                      onChange={(e) => setEditDraft((old) => ({ ...old, notes: e.target.value }))}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    عنوان بیماری
                    <input
                      autoFocus
                      required
                      maxLength={200}
                      value={editDraft.title ?? ''}
                      onChange={(e) => setEditDraft((old) => ({ ...old, title: e.target.value }))}
                    />
                  </label>
                  <label>
                    توضیحات بیماری
                    <textarea
                      rows={4}
                      maxLength={2000}
                      value={editDraft.description ?? ''}
                      onChange={(e) => setEditDraft((old) => ({ ...old, description: e.target.value }))}
                    />
                  </label>
                  <label>
                    تاریخ تشخیص
                    <input
                      type="date"
                      value={editDraft.diagnosedAt ?? ''}
                      onChange={(e) => setEditDraft((old) => ({ ...old, diagnosedAt: e.target.value }))}
                    />
                  </label>
                </>
              )}

              <footer className="patient-edit-actions">
                <button
                  type="button"
                  className="patient-edit-cancel"
                  onClick={closeEditForm}
                  disabled={editSaving}
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="patient-edit-save"
                  disabled={editSaving}
                >
                  {editSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
      {bookingDoctor && (
        <DoctorBooking
          doctor={bookingDoctor}
          api={API}
          authenticated
          onBooked={() => {
            void loadAppointments()
            setNotice('نوبت شما ثبت شد و فهرست نوبت‌ها به‌روزرسانی شد.')
          }}
          onClose={() => setBookingDoctor(null)}
        />
      )}    </main>
  )
}
