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

function getTotalActiveHoursPerMonth(textFile, driverID, month) {
  const content = fs.readFileSync(textFile, "utf8").replace(/\r/g, "")
  const lines = content.split("\n").filter(l => l.trim() !== "")

  const rows = lines.slice(1)

  const m = Number(month)

  let totalSeconds = 0

  for (let row of rows) {
    const parts = row.split(",")

    if (parts[0] === driverID) {
      const rowMonth = Number(parts[2].split("-")[1])

      if (rowMonth === m) {
        totalSeconds += parseDuration(parts[7])
      }
    }
  }

  return formatDuration(totalSeconds)
}

function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
  const shiftsContent = fs.readFileSync(textFile, "utf8").replace(/\r/g, "")
  const shiftLines = shiftsContent.split("\n").filter(l => l.trim() !== "")
  const shiftRows = shiftLines.slice(1)

  const ratesContent = fs.readFileSync(rateFile, "utf8").replace(/\r/g, "")
  const rateLines = ratesContent.split("\n").filter(l => l.trim() !== "")

  let dayOff = ""

  for (let line of rateLines) {
    const parts = line.split(",")
    if (parts[0] === driverID) {
      dayOff = parts[1]
      break
    }
  }

  const m = Number(month)
  let totalSeconds = 0

  for (let row of shiftRows) {
    const parts = row.split(",")

    if (parts[0] !== driverID)
      continue

    const date = parts[2]
    const rowMonth = Number(date.split("-")[1])

    if (rowMonth !== m)
      continue

    const d = new Date(date)
    const dayName = d.toLocaleDateString("en-US", { weekday: "long" })

    if (dayName === dayOff)
      continue

    if (date >= "2025-04-10" && date <= "2025-04-30")
      totalSeconds += 6 * 3600
    else
      totalSeconds += 8 * 3600 + 24 * 60
  }

  totalSeconds -= bonusCount * 2 * 3600

  if (totalSeconds < 0)
    totalSeconds = 0

  return formatDuration(totalSeconds)
}

function getNetPay(driverID, actualHours, requiredHours, rateFile) {
  const content = fs.readFileSync(rateFile, "utf8").replace(/\r/g, "")
  const lines = content.split("\n").filter(l => l.trim() !== "")

  let basePay = 0
  let tier = 0

  for (let line of lines) {
    const parts = line.split(",")

    if (parts[0] === driverID) {
      basePay = Number(parts[2])
      tier = Number(parts[3])
      break
    }
  }

  const actual = parseDuration(actualHours)
  const required = parseDuration(requiredHours)

  if (actual >= required)
    return basePay

  let allowedHours = 0

  if (tier === 1) allowedHours = 50
  else if (tier === 2) allowedHours = 20
  else if (tier === 3) allowedHours = 10
  else if (tier === 4) allowedHours = 3

  let missingSeconds = required - actual - allowedHours * 3600

  if (missingSeconds <= 0)
    return basePay

  const missingHours = Math.floor(missingSeconds / 3600)

  if (missingHours <= 0)
    return basePay

  const deductionPerHour = Math.floor(basePay / 185)
  const deduction = missingHours * deductionPerHour

  return basePay - deduction
}

module.exports = {
  getShiftDuration,
  getIdleTime,
  getActiveTime,
  metQuota,
  addShiftRecord,
  setBonus,
  countBonusPerMonth,
  getTotalActiveHoursPerMonth,
  getRequiredHoursPerMonth,
  getNetPay
}
