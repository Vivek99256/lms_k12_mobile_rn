import React from 'react';
import { MenuTile } from '../menu/types';
import { AcademicCalendarScreen } from './student/AcademicCalendarScreen';
import { AttendanceScreen } from './student/AttendanceScreen';
import { CircularsScreen } from './student/CircularsScreen';
import { HolidayListScreen } from './student/HolidayListScreen';
import { NotificationHubScreen } from './student/NotificationHubScreen';

export type TileScreenComponent = React.ComponentType<{ tile: MenuTile }>;

/**
 * screen_name (from the backend menu) -> dedicated native screen.
 * A tile only reaches one of these after the guard has confirmed the backend listed it for
 * this user; a screen_name with no entry here falls back to the generic API screen.
 */
export const screenRegistry: Record<string, TileScreenComponent> = {
  // S2 - student attendance (studentAttendanceAPI)
  student_attendance: AttendanceScreen,
  // S1 - student home (studentCalenderAPI, notificationHubAPI, circular/fetchData)
  academic_calendar: AcademicCalendarScreen,
  holiday_list: HolidayListScreen,
  notification_hub: NotificationHubScreen,
  circular_events: CircularsScreen,
};

export function registerScreens(entries: Record<string, TileScreenComponent>) {
  Object.assign(screenRegistry, entries);
}
