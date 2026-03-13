function parseAmPmTime(timeStr) {
  const trimmed = timeStr.trim().toLowerCase()
  const [timePart, period] = trimmed.split(/\s+/)
  let [hours, minutes, seconds] = timePart.split(":").map(Number)

  if (period === "am") {
    if (hours === 12) hours = 0
  } else {
    if (hours !== 12) hours += 12
  }

  return hours * 3600 + minutes * 60 + seconds
}

function parseDuration(durationStr) {
  const [h, m, s] = durationStr.split(":").map(Number)
  return h * 3600 + m * 60 + s
}

function formatDuration(sec) {
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  return `${hours}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`
}

function getShiftDuration(startTime, endTime) {
  let start = parseAmPmTime(startTime)
  let end = parseAmPmTime(endTime)

  if (end < start) end += 24 * 3600

  return formatDuration(end - start)
}

function getIdleTime(startTime, endTime) {
  let start = parseAmPmTime(startTime)
  let end = parseAmPmTime(endTime)

  if (end < start) end += 24 * 3600

  const startDelivery = 8 * 3600
  const endDelivery = 22 * 3600

  let idle = 0

  if (start < startDelivery)
    idle += Math.min(end, startDelivery) - start

  if (end > endDelivery)
    idle += end - Math.max(start, endDelivery)

  return formatDuration(idle)
}

function getActiveTime(shiftDuration, idleTime) {
  const shift = parseDuration(shiftDuration)
  const idle = parseDuration(idleTime)
  return formatDuration(shift - idle)
}

function metQuota(date, activeTime) {
  const active = parseDuration(activeTime)

  const required =
    date >= "2025-04-10" && date <= "2025-04-30"
      ? 6 * 3600
      : 8 * 3600 + 24 * 60

  return active >= required
}

module.exports = {
  getShiftDuration,
  getIdleTime,
  getActiveTime,
  metQuota
}
