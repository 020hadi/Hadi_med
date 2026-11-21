import { useEffect, useState } from 'react'
import { toGregorian, toJalaali, jalaaliMonthLength } from 'jalaali-js'

type Slot = { startAt: string; endAt: string; available: boolean }
type Doctor = { doctorId: string; firstName: string; lastName: string }

function unwrap(value: any) {
  return value?.data ?? value?.value ?? value
}

function tehranDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const part = (type: string) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}


const jalaliMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]
const persianNumber = new Intl.NumberFormat('fa-IR')

function gregorianString(jy: number, jm: number, jd: number) {
  const g = toGregorian(jy, jm, jd)
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`
}

function currentJalaliMonth() {
  const [gy, gm, gd] = tehranDate().split('-').map(Number)
  const { jy, jm } = toJalaali(gy, gm, gd)
  return { jy, jm }
}
export default function DoctorBooking({
  doctor,
  api,
  onClose,
  authenticated = false,
  onBooked,
}: {
  doctor: Doctor;
  api: string;
  onClose: () => void;
  authenticated?: boolean;
  onBooked?: () => void;
}) {
  const [date, setDate] = useState(tehranDate())
  const [visibleMonth, setVisibleMonth] = useState(currentJalaliMonth)
  const today = tehranDate()
  const monthStart = toGregorian(visibleMonth.jy, visibleMonth.jm, 1)
  const leadingBlanks = (new Date(Date.UTC(monthStart.gy, monthStart.gm - 1, monthStart.gd)).getUTCDay() + 1) % 7
  const monthDays = jalaaliMonthLength(visibleMonth.jy, visibleMonth.jm)
  const shiftMonth = (delta: number) => setVisibleMonth(current => {
    const total = current.jy * 12 + current.jm - 1 + delta
    return { jy: Math.floor(total / 12), jm: ((total % 12) + 12) % 12 + 1 }
  })
  const [slots, setSlots] = useState<Slot[]>([])
  const [selected, setSelected] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [appointmentId, setAppointmentId] = useState('')
  const [trackingCode, setTrackingCode] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'slot' | 'otp' | 'done'>('slot')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    setSlots([])
    setSelected('')
    setError('')
    const load = async () => {
      try {
        const response = await fetch(
          `${api}/appointments/doctors/${doctor.doctorId}/availability?date=${encodeURIComponent(date)}`
        )
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'دریافت زمان‌های آزاد ناموفق بود.')
        const data = unwrap(result)
        if (!Array.isArray(data?.slots)) throw new Error('ساختار زمان‌های آزاد معتبر نیست.')
        if (active) setSlots(data.slots)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'خطا در دریافت زمان‌ها')
      }
    }
    void load()
    return () => { active = false }
  }, [api, date, doctor.doctorId])

  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selected) {
      setError('ابتدایک زمان آزاد انتخاب کنید.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('hadimed_token');

      if (authenticated && !token) {
        throw new Error('نشست کاربری معتبر نیست. دوباره وارد شوید.');
      }

      const response = await fetch(
        `${api}/appointments/${authenticated ? 'me/request-otp' : 'request-otp'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authenticated && token
              ? { Authorization: `Bearer ${token}` }
              : {}),
          },
          body: JSON.stringify(
            authenticated
              ? {
                  doctorId: doctor.doctorId,
                  startAt: selected,
                }
              : {
                  doctorId: doctor.doctorId,
                  firstName: firstName.trim(),
                  lastName: lastName.trim(),
                  phone: phone.trim(),
                  startAt: selected,
                },
          ),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(result.message)
            ? result.message.join('، ')
            : result.message || 'ارسال کد تأیید ناموفق بود.',
        );
      }

      const data = unwrap(result);

      if (!data?.appointmentId) {
        throw new Error('شناسه نوبت در پاسخ سرور موجود نیست.');
      }

      setAppointmentId(data.appointmentId);
      setTrackingCode(data.trackingCode || '');
      setStep('otp');
      setMessage('کد تأیید برای شماره همراه شما ارسال شد.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت درخواست نوبت');
    } finally {
      setLoading(false);
    }
  };

    const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('hadimed_token');

      if (authenticated && !token) {
        throw new Error('نشست کاربری معتبر نیست. دوباره وارد شوید.');
      }

      const response = await fetch(
        `${api}/appointments/${authenticated ? 'me/verify-otp' : 'verify-otp'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authenticated && token
              ? { Authorization: `Bearer ${token}` }
              : {}),
          },
          body: JSON.stringify({ appointmentId, code }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(result.message)
            ? result.message.join('، ')
            : result.message || 'کد تأیید معتبر نیست.',
        );
      }

      const data = unwrap(result);
      setTrackingCode(data?.appointment?.trackingCode || trackingCode);
      setStep('done');
      setMessage('نوبت شما با موفقیت تأیید شد.');
      onBooked?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تأیید نوبت ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

    const resendOtp = async () => {
    setLoading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('hadimed_token');

      if (authenticated && !token) {
        throw new Error('نشست کاربری معتبر نیست. دوباره وارد شوید.');
      }

      const response = await fetch(
        `${api}/appointments/${authenticated ? 'me/resend-otp' : 'resend-otp'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authenticated && token
              ? { Authorization: `Bearer ${token}` }
              : {}),
          },
          body: JSON.stringify({ appointmentId }),
        },
      );

      const result = await response.json();

      if (response.status === 404) {
        throw new Error('مهلت رزرو پایان یافته است. لطفاً تاریخ و زمان دیگری انتخاب کنید.');
      }

      if (!response.ok) {
        const apiMessage = Array.isArray(result.message)
          ? result.message.join('، ')
          : result.message;
        throw new Error(apiMessage || 'ارسال مجدد کد ناموفق بود.');
      }

      setCode('');
      setMessage('کد جدید ارسال شد.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ارسال مجدد کد ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

    return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <section className="auth-modal booking-modal" dir="rtl">
        <button type="button" className="modal-close" onClick={onClose} aria-label="بستن">×</button>
        <span className="section-kicker">رزرو نوبت HadiMed</span>
        <h2>دکتر {doctor.firstName} {doctor.lastName}</h2>
        {step === 'slot' && (
          <>
            <label className="booking-label">تاریخ مراجعه
              <div className="jalali-calendar" dir="rtl">
                <div className="jalali-calendar-header">
                  <button type="button" aria-label="ماه قبل" onClick={() => shiftMonth(-1)}>‹</button>
                  <strong>{jalaliMonths[visibleMonth.jm - 1]} {persianNumber.format(visibleMonth.jy)}</strong>
                  <button type="button" aria-label="ماه بعد" onClick={() => shiftMonth(1)}>›</button>
                </div>
                <div className="jalali-calendar-grid">
                  {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((day, index) => (
                    <span className="jalali-weekday" key={index}>{day}</span>
                  ))}
                  {Array.from({ length: leadingBlanks }, (_, index) => (
                    <span className="jalali-calendar-empty" key={`empty-${index}`} />
                  ))}
                  {Array.from({ length: monthDays }, (_, index) => {
                    const day = index + 1
                    const gregorian = gregorianString(visibleMonth.jy, visibleMonth.jm, day)
                    const disabled = gregorian < today
                    return (
                      <button
                        type="button"
                        key={day}
                        disabled={disabled}
                        aria-pressed={date === gregorian}
                        className={`jalali-day${date === gregorian ? ' selected' : ''}`}
                        onClick={() => {
                          setDate(gregorian)
                          setSelected('')
                          setError('')
                        }}
                      >
                        {persianNumber.format(day)}
                      </button>
                    )
                  })}
                </div>
                <p className="jalali-selected-date">
                  تاریخ انتخاب‌شده: {(() => {
                    const [gy, gm, gd] = date.split('-').map(Number)
                    const j = toJalaali(gy, gm, gd)
                    return `${persianNumber.format(j.jd)} ${jalaliMonths[j.jm - 1]} ${persianNumber.format(j.jy)}`
                  })()}
                </p>
              </div>
            </label>
            <p className="booking-hint">یکی از زمان‌های آزاد را انتخاب کنید.</p>
            <div className="booking-slots">
              {slots.filter(slot => slot.available).map(slot => (
                <button type="button" key={slot.startAt} className={selected === slot.startAt ? 'booking-slot selected' : 'booking-slot'} onClick={() => setSelected(slot.startAt)}>
                  {new Date(slot.startAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' })}
                </button>
              ))}
              {slots.length > 0 && slots.every(slot => !slot.available) && <p className="empty">برای این تاریخ زمان آزادی وجود ندارد.</p>}
              {slots.length === 0 && !error && <p className="empty">زمان آزادی برای این تاریخ ثبت نشده است.</p>}
            </div>
            <form onSubmit={requestOtp}>
              {!authenticated && (
                <>
                  <div className="form-row">
                    <label>
                      نام
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                      />
                    </label>
                    <label>
                      نام خانوادگی
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    شماره موبایل
                    <input
                      required
                      type="tel"
                      dir="ltr"
                      placeholder="09123456789 or +989123456789"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </label>
                </>
              )}
              <button
                className="btn btn-primary submit-btn"
                disabled={loading || !selected}
              >
                {loading ? 'در حال ارسال...' : 'ثبت درخواست و دریافت کد'}
              </button>
            </form>
          </>
        )}
        {step === 'otp' && (
          <form onSubmit={verifyOtp}>
            <p className="booking-hint">{message}</p>
            <label>کد شش‌رقمی پیامک‌شده
              <input required dir="ltr" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </label>
            <button className="btn btn-primary submit-btn" disabled={loading || code.length !== 6}>{loading ? 'در حال بررسی...' : 'تأیید و نهایی‌کردن نوبت'}</button>
            <button type="button" className="booking-resend" disabled={loading} onClick={resendOtp}>ارسال مجدد کد</button>
          </form>
        )}
        {step === 'done' && (
          <div className="form-success">
            <p>{message}</p>
            {trackingCode && <p>کد رهگیری نوبت: <strong dir="ltr">{trackingCode}</strong></p>}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        {step === 'slot' && message && <p className="form-success">{message}</p>}
        <button type="button" className="booking-cancel" onClick={onClose}>{step === 'done' ? 'بستن' : 'انصراف'}</button>
      </section>
    </div>
  )
}