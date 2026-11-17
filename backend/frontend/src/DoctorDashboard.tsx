import { useEffect, useState, type FormEvent } from 'react'
import { Activity, Plus, Trash2, Save, Clock3, CalendarDays, RefreshCw } from 'lucide-react'
import './DoctorDashboard.css'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'

const weekdays = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
]

type Schedule = {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  slotDurationMinutes: number
  isActive: boolean
}

function getErrorMessage(result: any) {
  if (Array.isArray(result?.message)) return result.message.join('، ')
  if (typeof result?.message === 'string') return result.message
  return 'ارتباط با سرور برقرار نشد.'
}

export default function DoctorDashboard() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const token = sessionStorage.getItem('hadimed_token')

  const loadSchedules = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API}/doctors/me/schedules`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const result = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(result))

      const data = result.data ?? result
      setSchedules(Array.isArray(data.schedules) ? data.schedules : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت برنامه کاری')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSchedules()
  }, [])

  const addSchedule = () => {
    setSchedules(current => [
      ...current,
      {
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '13:00',
        slotDurationMinutes: 30,
        isActive: true,
      },
    ])
  }

  const updateSchedule = (index: number, changes: Partial<Schedule>) => {
    setSchedules(current =>
      current.map((item, i) => i === index ? { ...item, ...changes } : item)
    )
  }

  const removeSchedule = (index: number) => {
    setSchedules(current => current.filter((_, i) => i !== index))
  }

  const saveSchedules = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await fetch(`${API}/doctors/me/schedules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schedules: schedules.map(({ dayOfWeek, startTime, endTime, slotDurationMinutes, isActive }) => ({
            dayOfWeek,
            startTime,
            endTime,
            slotDurationMinutes: Number(slotDurationMinutes),
            isActive,
          })),
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(getErrorMessage(result))

      const data = result.data ?? result
      setSchedules(Array.isArray(data.schedules) ? data.schedules : schedules)
      setNotice('برنامه کاری شما با موفقیت ذخیره شد.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره برنامه انجام نشد.')
    } finally {
      setSaving(false)
    }
  }

  const groupedSchedules = weekdays.map((day, dayIndex) => ({
    day,
    dayIndex,
    items: schedules
      .map((item, index) => ({ ...item, originalIndex: index }))
      .filter(item => item.dayOfWeek === dayIndex),
  }))

  return (
    <main className="doctor-dashboard" dir="rtl">
      <div className="doctor-container">
        <div className="doctor-welcome">
          <div>
            <span className="doctor-kicker"><Activity size={16} /> پنل مدیریت پزشک</span>
            <h1>برنامه کاری من</h1>
            <p>روزها و ساعت‌های حضور خود را برای دریافت نوبت تنظیم کنید.</p>
          </div>
          <div className="doctor-welcome-icon"><CalendarDays size={34} /></div>
        </div>

        <div className="doctor-info">
          <Clock3 size={19} />
          <span>منطقه زمانی برنامه: تهران (Asia/Tehran)</span>
        </div>

        <form onSubmit={saveSchedules}>
          <div className="schedule-toolbar">
            <div>
              <h2>ساعات کاری هفتگی</h2>
              <p>برای هر روز می‌توانید یک یا چند بازه زمانی تعریف کنید.</p>
            </div>
            <button type="button" className="doctor-add-btn" onClick={addSchedule}>
              <Plus size={18} /> افزودن بازه
            </button>
          </div>

          {loading ? (
            <div className="doctor-state"><RefreshCw className="spin" /> در حال دریافت برنامه کاری...</div>
          ) : (
            <div className="schedule-days">
              {groupedSchedules.map(group => (
                <section className="schedule-day" key={group.dayIndex}>
                  <div className="schedule-day-heading">
                    <strong>{group.day}</strong>
                    <span>{group.items.length} بازه</span>
                  </div>

                  {group.items.length === 0 ? (
                    <p className="schedule-empty">برای این روز بازه کاری ثبت نشده است.</p>
                  ) : (
                    <div className="schedule-items">
                      {group.items.map(item => (
                        <div className="schedule-item" key={item.id ?? `new-${item.originalIndex}`}>
                          <label>
                            <span>روز هفته</span>
                            <select
                              value={item.dayOfWeek}
                              onChange={e => updateSchedule(item.originalIndex, { dayOfWeek: Number(e.target.value) })}
                            >
                              {weekdays.map((day, index) => (
                                <option value={index} key={index}>{day}</option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span>ساعت شروع</span>
                            <input
                              type="time"
                              value={item.startTime}
                              onChange={e => updateSchedule(item.originalIndex, { startTime: e.target.value })}
                              required
                            />
                          </label>

                          <label>
                            <span>ساعت پایان</span>
                            <input
                              type="time"
                              value={item.endTime}
                              onChange={e => updateSchedule(item.originalIndex, { endTime: e.target.value })}
                              required
                            />
                          </label>

                          <label>
                            <span>مدت هر نوبت</span>
                            <select
                              value={item.slotDurationMinutes}
                              onChange={e => updateSchedule(item.originalIndex, { slotDurationMinutes: Number(e.target.value) })}
                            >
                              {[10, 15, 20, 30, 45, 60, 90, 120].map(value => (
                                <option value={value} key={value}>{value} دقیقه</option>
                              ))}
                            </select>
                          </label>

                          <label className="schedule-active">
                            <input
                              type="checkbox"
                              checked={item.isActive}
                              onChange={e => updateSchedule(item.originalIndex, { isActive: e.target.checked })}
                            />
                            فعال
                          </label>

                          <button
                            type="button"
                            className="schedule-delete"
                            onClick={() => removeSchedule(item.originalIndex)}
                            aria-label="حذف بازه"
                            title="حذف بازه"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          {error && <div className="doctor-error">{error}</div>}
          {notice && <div className="doctor-success">{notice}</div>}

          <div className="doctor-save-row">
            <span>تغییرات تا زمان ذخیره در سرور ثبت نمی‌شوند.</span>
            <button className="doctor-save-btn" type="submit" disabled={loading || saving}>
              <Save size={18} />
              {saving ? 'در حال ذخیره...' : 'ذخیره برنامه کاری'}
            </button>
          </div>
        </form>

        <div className="doctor-back-row">
          <button type="button" onClick={loadSchedules} disabled={loading}>
            <RefreshCw size={16} /> بارگذاری مجدد
          </button>
        </div>
      </div>
    </main>
  )
}