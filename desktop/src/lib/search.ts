import { EMPTY_FILTER, type EventFilter } from "./filter";
import { createMemoryStore } from "./localStore";

export const filterStore = createMemoryStore<EventFilter>(EMPTY_FILTER);
export const searchOpenStore = createMemoryStore<boolean>(false);
