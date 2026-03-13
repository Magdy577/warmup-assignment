const fs = require("fs")
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
function addShiftRecord(textFile, shiftObj) {

  const content = fs.readFileSync(textFile, "utf8").replace(/\r/g,"")
  const lines = content.split("\n").filter(l => l.trim() !== "")

  const header = lines[0]
  const rows = lines.slice(1)

  for (let row of rows) {
    const parts = row.split(",")
    if (parts[0] === shiftObj.driverID && parts[2] === shiftObj.date)
      return {}
  }

  const shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime)
  const idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime)
  const activeTime = getActiveTime(shiftDuration, idleTime)
  const quota = metQuota(shiftObj.date, activeTime)

  const newRow = [
    shiftObj.driverID,
    shiftObj.driverName,
    shiftObj.date,
    shiftObj.startTime,
    shiftObj.endTime,
    shiftDuration,
    idleTime,
    activeTime,
    quota,
    false
  ].join(",")

  rows.push(newRow)

  const newFile = [header, ...rows].join("\n")
  fs.writeFileSync(textFile, newFile)

  return {
    driverID: shiftObj.driverID,
    driverName: shiftObj.driverName,
    date: shiftObj.date,
    startTime: shiftObj.startTime,
    endTime: shiftObj.endTime,
    shiftDuration,
    idleTime,
    activeTime,
    metQuota: quota,
    hasBonus: false
  }

}
function setBonus(textFile, driverID, date, newValue) {

  const content = fs.readFileSync(textFile,"utf8").replace(/\r/g,"")
  const lines = content.split("\n").filter(l => l.trim() !== "")

  const header = lines[0]
  const rows = lines.slice(1)

  const updated = rows.map(row => {

    const parts = row.split(",")

    if (parts[0] === driverID && parts[2] === date) {
      parts[9] = String(newValue)
    }

    return parts.join(",")

  })

  fs.writeFileSync(textFile,[header,...updated].join("\n"))

}
function countBonusPerMonth(textFile, driverID, month) {

  const content = fs.readFileSync(textFile,"utf8").replace(/\r/g,"")
  const lines = content.split("\n").filter(l => l.trim() !== "")

  const rows = lines.slice(1)

  const driverRows = rows.filter(r => r.split(",")[0] === driverID)

  if (driverRows.length === 0)
    return -1

  const m = Number(month)

  let count = 0

  for (let row of driverRows) {

    const parts = row.split(",")

    const rowMonth = Number(parts[2].split("-")[1])

    if (rowMonth === m && parts[9] === "true")
      count++

  }

  return count

}
