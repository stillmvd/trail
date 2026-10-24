import { TIMELINE_MIN_DATE, TIMELINE_MAX_DATE } from "@/lib/constants";
import { getEventsInRange } from "./events";
import { getMarksInRange } from "./marks";
import { listPeople } from "./people";

export const listAllEvents = () => getEventsInRange(TIMELINE_MIN_DATE, TIMELINE_MAX_DATE);

export const loadTimeline = async () => {
  const [events, marks] = await Promise.all([
    listAllEvents(),
    getMarksInRange(TIMELINE_MIN_DATE, TIMELINE_MAX_DATE),
  ]);
  return { events, marks };
};

export const loadCalendar = async () => {
  const [events, marks, people] = await Promise.all([
    listAllEvents(),
    getMarksInRange(TIMELINE_MIN_DATE, TIMELINE_MAX_DATE),
    listPeople(),
  ]);
  return { events, marks, people };
};
