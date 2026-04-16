export function normalizeText(value = "") {
  return String(value ?? "").trim().toLowerCase();
}

export function isRentalLocationName(name = "") {
  return normalizeText(name).includes("alquiler");
}

export function parseDateInputValue(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function parseTimeInputValue(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hours, minutes };
}

export function formatDateInputValue(value, locale = "es-VE") {
  const date = parseDateInputValue(value);
  if (!date) return "";
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDateInputValue(value, locale = "es-VE") {
  const date = parseDateInputValue(value);
  if (!date) return "";
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatTimeInputValue(value, locale = "es-VE") {
  const time = parseTimeInputValue(value);
  if (!time) return "";
  const date = new Date(2000, 0, 1, time.hours, time.minutes, 0, 0);
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateRangeValue(startDate, endDate, locale = "es-VE") {
  const start = formatShortDateInputValue(startDate, locale);
  const end = formatShortDateInputValue(endDate, locale);
  const separator = locale.startsWith("en") ? "to" : "al";
  if (!start && !end) return "";
  if (start && end) return `${start} ${separator} ${end}`;
  return start || end;
}

export function formatTimeRangeValue(startTime, endTime, locale = "es-VE") {
  const start = formatTimeInputValue(startTime, locale);
  const end = formatTimeInputValue(endTime, locale);
  const separator = locale.startsWith("en") ? "to" : "a";
  if (!start && !end) return "";
  if (start && end) return `${start} ${separator} ${end}`;
  return start || end;
}

export function hasRentalDateRange(entity = {}) {
  return Boolean(entity?.rentalStartDate || entity?.rentalEndDate);
}

export function hasRentalTimeRange(entity = {}) {
  return Boolean(entity?.rentalStartTime || entity?.rentalEndTime);
}

export function getRentalRangeKind(entity = {}) {
  if (hasRentalDateRange(entity)) return "date";
  if (hasRentalTimeRange(entity)) return "time";
  return null;
}

export function formatRentalRangeValue(entity = {}, locale = "es-VE") {
  const kind = getRentalRangeKind(entity);
  if (kind === "date") return formatDateRangeValue(entity.rentalStartDate, entity.rentalEndDate, locale);
  if (kind === "time") return formatTimeRangeValue(entity.rentalStartTime, entity.rentalEndTime, locale);
  return "";
}

export function getRemainingRentalDays(endDate, today = new Date()) {
  const end = parseDateInputValue(endDate);
  if (!end) return null;
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const diffDays = Math.round((end.getTime() - current.getTime()) / 86400000);
  return Math.max(0, diffDays);
}

export function getSignedRentalDays(endDate, today = new Date()) {
  const end = parseDateInputValue(endDate);
  if (!end) return null;
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  return Math.round((end.getTime() - current.getTime()) / 86400000);
}

export function formatRemainingRentalDaysLabel(endDate, locale = "es") {
  const remainingDays = getRemainingRentalDays(endDate);
  if (remainingDays == null) return "";
  if (locale === "en") return `${remainingDays} day${remainingDays === 1 ? "" : "s"}`;
  return `${remainingDays} día${remainingDays === 1 ? "" : "s"}`;
}

export function getRemainingRentalMinutes(endTime, now = new Date()) {
  const time = parseTimeInputValue(endTime);
  if (!time) return null;
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    time.hours,
    time.minutes,
    0,
    0
  );
  const diffMinutes = Math.ceil((end.getTime() - now.getTime()) / 60000);
  return Math.max(0, diffMinutes);
}

export function getSignedRentalMinutes(endTime, now = new Date()) {
  const time = parseTimeInputValue(endTime);
  if (!time) return null;
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    time.hours,
    time.minutes,
    0,
    0
  );
  return Math.ceil((end.getTime() - now.getTime()) / 60000);
}

function formatMinuteAmountLabel(totalMinutes, locale = "es") {
  const safeMinutes = Math.max(0, totalMinutes ?? 0);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (locale === "en") {
    if (hours && minutes) return `${hours} h ${minutes} min`;
    if (hours) return `${hours} h`;
    return `${minutes} min`;
  }

  if (hours && minutes) return `${hours} h ${minutes} min`;
  if (hours) return `${hours} h`;
  return `${minutes} min`;
}

export function formatRemainingRentalHoursLabel(endTime, locale = "es") {
  const remainingMinutes = getRemainingRentalMinutes(endTime);
  if (remainingMinutes == null) return "";
  return formatMinuteAmountLabel(remainingMinutes, locale);
}

export function formatRemainingRentalLabel(entity = {}, locale = "es") {
  const kind = getRentalRangeKind(entity);
  if (kind === "date") return formatRemainingRentalDaysLabel(entity.rentalEndDate, locale);
  if (kind === "time") return formatRemainingRentalHoursLabel(entity.rentalEndTime, locale);
  return "";
}

export function getRentalCountdownState(entity = {}, now = new Date(), locale = "es") {
  const kind = getRentalRangeKind(entity);

  if (kind === "date") {
    const signedDays = getSignedRentalDays(entity.rentalEndDate, now);
    if (signedDays == null) return null;
    if (signedDays < 0) {
      const extraDays = Math.abs(signedDays);
      const extraLabel = locale === "en"
        ? `${extraDays} day${extraDays === 1 ? "" : "s"}`
        : `${extraDays} dí­a${extraDays === 1 ? "" : "s"}`;
      return {
        kind,
        phase: "overdue",
        amount: extraDays,
        label: extraLabel,
        displayLabel: extraLabel,
        fieldKey: "daysExtra",
        canReturn: true,
      };
    }

    return {
      kind,
      phase: signedDays === 0 ? "due" : "remaining",
      amount: signedDays,
      label: locale === "en"
        ? `${signedDays} day${signedDays === 1 ? "" : "s"}`
        : `${signedDays} dí­a${signedDays === 1 ? "" : "s"}`,
      displayLabel: locale === "en"
        ? `${signedDays} day${signedDays === 1 ? "" : "s"}`
        : `${signedDays} dí­a${signedDays === 1 ? "" : "s"}`,
      fieldKey: "daysRemaining",
      canReturn: signedDays === 0,
    };
  }

  if (kind === "time") {
    const signedMinutes = getSignedRentalMinutes(entity.rentalEndTime, now);
    if (signedMinutes == null) return null;
    if (signedMinutes < 0) {
      return {
        kind,
        phase: "overdue",
        amount: Math.abs(signedMinutes),
        label: formatMinuteAmountLabel(Math.abs(signedMinutes), locale),
        displayLabel: formatMinuteAmountLabel(Math.abs(signedMinutes), locale),
        fieldKey: "hoursExtra",
        canReturn: true,
      };
    }

    return {
      kind,
      phase: signedMinutes === 0 ? "due" : "remaining",
      amount: signedMinutes,
      label: formatMinuteAmountLabel(signedMinutes, locale),
      displayLabel: formatMinuteAmountLabel(signedMinutes, locale),
      fieldKey: "hoursRemaining",
      canReturn: signedMinutes === 0,
    };
  }

  return null;
}
