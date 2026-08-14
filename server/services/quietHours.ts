export function parseTimeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  
  // Format check for 24-hour "HH:MM" e.g. "22:00"
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Format check for 12-hour "08:00 AM" or "10:00 PM"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  return 0;
}

export function isQuietHours(
  currentMinutes: number,
  startStr = '22:00',
  endStr = '07:00'
): boolean {
  const startMins = parseTimeStringToMinutes(startStr);
  const endMins = parseTimeStringToMinutes(endStr);

  if (startMins === endMins) return false;

  if (startMins > endMins) {
    // Quiet hours span midnight, e.g. 22:00 (1320 mins) to 07:00 (420 mins)
    return currentMinutes >= startMins || currentMinutes < endMins;
  } else {
    // Quiet hours within same day, e.g. 13:00 to 15:00
    return currentMinutes >= startMins && currentMinutes < endMins;
  }
}
