import { todayIso } from "@/lib/dates";
import type { RecurringBill } from "@/lib/types";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

export function describeBillSchedule(bill: RecurringBill) {
  if (bill.frequency === "monthly") {
    const day = bill.dueDay ?? partsFromDate(bill.startDate).day;
    return `Bill due on the ${day}${ordinal(day)} of every month`;
  }

  if (bill.frequency === "weekly") {
    return `Every ${weekdays[partsFromDate(bill.startDate).weekday]}`;
  }

  if (bill.frequency === "biweekly") {
    return `Every other week starting ${bill.startDate}`;
  }

  if (bill.frequency === "yearly") {
    const parts = partsFromDate(bill.startDate);
    return `Every ${months[parts.month - 1]} ${parts.day}`;
  }

  return `One-Time on ${bill.startDate}`;
}

function partsFromDate(value: string | null | undefined) {
  const parsed = value ? new Date(`${value}T00:00:00`) : new Date();

  if (Number.isNaN(parsed.getTime())) {
    return partsFromDate(todayIso());
  }

  return {
    day: parsed.getDate(),
    month: parsed.getMonth() + 1,
    weekday: parsed.getDay()
  };
}

function ordinal(value: number) {
  if (value % 100 >= 11 && value % 100 <= 13) {
    return "th";
  }

  if (value % 10 === 1) {
    return "st";
  }

  if (value % 10 === 2) {
    return "nd";
  }

  if (value % 10 === 3) {
    return "rd";
  }

  return "th";
}
